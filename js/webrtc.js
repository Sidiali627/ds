// webrtc.js - Native WebRTC Video & Audio Consultation Engine with Supabase Realtime Signaling
export class WebRTCManager {
    constructor(supabaseClient, consultationId, currentUserId, callbacks = {}) {
        this.supabase = supabaseClient;
        this.consultationId = consultationId;
        this.currentUserId = currentUserId;
        this.callbacks = callbacks; // { onRemoteStream, onStatusChange, onError }
        
        this.peerConnection = null;
        this.localStream = null;
        this.screenStream = null;
        this.signalChannel = null;
        this.isMicMuted = false;
        this.isVideoOff = false;
        this.isScreenSharing = false;

        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' }
            ]
        };
    }

    async init(localVideoEl) {
        try {
            this.updateStatus('جاري الحصول على الكاميرا والميكروفون...');
            this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (localVideoEl) localVideoEl.srcObject = this.localStream;
            
            this.setupPeerConnection();
            this.setupSignaling();
        } catch (err) {
            console.error("WebRTC UserMedia Error:", err);
            // Fallback to audio only if camera is unavailable
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                this.isVideoOff = true;
                this.setupPeerConnection();
                this.setupSignaling();
            } catch (aErr) {
                this.updateStatus('تعذر الوصول للكاميرا والميكروفون');
                if (this.callbacks.onError) this.callbacks.onError(aErr);
            }
        }
    }

    setupPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.iceServers);

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // On Remote Stream
        this.peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                if (this.callbacks.onRemoteStream) {
                    this.callbacks.onRemoteStream(event.streams[0]);
                }
            }
        };

        // On ICE Candidate
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.signalChannel) {
                this.signalChannel.send({
                    type: 'broadcast',
                    event: 'ice-candidate',
                    payload: { candidate: event.candidate, senderId: this.currentUserId }
                });
            }
        };

        // Connection status changes
        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            this.updateStatus(`حالة الاتصال: ${state}`);
            if (state === 'failed' || state === 'disconnected') {
                this.reconnect();
            }
        };
    }

    setupSignaling() {
        this.signalChannel = this.supabase.channel(`webrtc_signal_${this.consultationId}`);

        this.signalChannel
            .on('broadcast', { event: 'offer' }, async (payload) => {
                if (payload.payload.senderId === this.currentUserId) return;
                await this.handleOffer(payload.payload.offer);
            })
            .on('broadcast', { event: 'answer' }, async (payload) => {
                if (payload.payload.senderId === this.currentUserId) return;
                await this.handleAnswer(payload.payload.answer);
            })
            .on('broadcast', { event: 'ice-candidate' }, async (payload) => {
                if (payload.payload.senderId === this.currentUserId) return;
                try {
                    if (this.peerConnection && payload.payload.candidate) {
                        await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
                    }
                } catch (e) {
                    console.error("Error adding ICE Candidate:", e);
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    this.updateStatus('جاهز للاتصال المرئي');
                }
            });
    }

    async createCall() {
        if (!this.peerConnection) return;
        this.updateStatus('جاري إنشاء المكالمة ورنين الطرف الآخر...');
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);

        this.signalChannel.send({
            type: 'broadcast',
            event: 'offer',
            payload: { offer: offer, senderId: this.currentUserId }
        });
    }

    async handleOffer(offer) {
        if (!this.peerConnection) return;
        this.updateStatus('تم استقبال مكالمة وارادها...');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.signalChannel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { answer: answer, senderId: this.currentUserId }
        });
    }

    async handleAnswer(answer) {
        if (!this.peerConnection) return;
        this.updateStatus('تم الاتصال المرئي بنجاح 🟢');
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }

    toggleMic() {
        if (!this.localStream) return false;
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMicMuted = !audioTrack.enabled;
            return !this.isMicMuted;
        }
        return false;
    }

    toggleCamera() {
        if (!this.localStream) return false;
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            this.isVideoOff = !videoTrack.enabled;
            return !this.isVideoOff;
        }
        return false;
    }

    async toggleScreenShare(remoteVideoEl) {
        if (!this.isScreenSharing) {
            try {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = this.screenStream.getVideoTracks()[0];
                
                const sender = this.peerConnection.getSenders().find(s => s.track.kind === 'video');
                if (sender) sender.replaceTrack(screenTrack);

                screenTrack.onended = () => this.stopScreenShare();
                this.isScreenSharing = true;
                return true;
            } catch (err) {
                console.error("Screen Share Error:", err);
                return false;
            }
        } else {
            this.stopScreenShare();
            return false;
        }
    }

    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(t => t.stop());
            this.screenStream = null;
        }
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender && videoTrack) sender.replaceTrack(videoTrack);
        }
        this.isScreenSharing = false;
    }

    reconnect() {
        this.updateStatus('جاري إعادة الاتصال تلقائياً...');
        setTimeout(() => this.createCall(), 2000);
    }

    updateStatus(msg) {
        if (this.callbacks.onStatusChange) {
            this.callbacks.onStatusChange(msg);
        }
    }

    endCall() {
        if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
        if (this.screenStream) this.screenStream.getTracks().forEach(t => t.stop());
        if (this.peerConnection) this.peerConnection.close();
        if (this.signalChannel) this.signalChannel.unsubscribe();
        this.updateStatus('تم إنهاء المكالمة المرئية');
    }
}
