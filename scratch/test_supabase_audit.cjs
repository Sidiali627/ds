const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const projectRoot = path.resolve(__dirname, '..');

// Import config
const configPath = path.join(projectRoot, 'js/config.js');
const configContent = fs.readFileSync(configPath, 'utf8');

const urlMatch = configContent.match(/https:\/\/[a-z0-9]+\.supabase\.co/);
const keyMatch = configContent.match(/eyJ[a-zA-Z0-9_\-\.]+/);

const SUPABASE_URL = urlMatch ? urlMatch[0] : null;
const SUPABASE_ANON_KEY = keyMatch ? keyMatch[0] : null;

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  steps: []
};

function assertTest(name, condition, details = '') {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    testResults.steps.push({ name, status: 'PASSED', details });
    console.log(`✅ [PASSED] ${name}`);
  } else {
    testResults.failed++;
    testResults.steps.push({ name, status: 'FAILED', details });
    console.log(`❌ [FAILED] ${name} -> ${details}`);
  }
}

async function runAudit() {
  console.log('================================================================');
  console.log('Running Supabase API Configuration & Security Audit');
  console.log('================================================================\n');

  // 1. Client Initialization
  console.log('--- 1. Client Initialization & Config Contracts ---');
  assertTest('js/config.js defines valid SUPABASE_URL matching provided project',
    SUPABASE_URL === 'https://xsuednrcrzbjdyrdrgat.supabase.co', `URL is ${SUPABASE_URL}`);

  assertTest('js/config.js defines valid Anon/Publishable Key',
    Boolean(SUPABASE_ANON_KEY && SUPABASE_ANON_KEY.startsWith('eyJ')), 'Anon key format valid');

  assertTest('.env.example exists and contains placeholders only (no real secrets)',
    fs.existsSync(path.join(projectRoot, '.env.example')) &&
    fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8').includes('your-anon-or-publishable-key-here') &&
    !fs.readFileSync(path.join(projectRoot, '.env.example'), 'utf8').includes(SUPABASE_ANON_KEY));

  assertTest('.gitignore exists and excludes .env and secret files',
    fs.existsSync(path.join(projectRoot, '.gitignore')) &&
    fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8').includes('.env.local'));

  assertTest('js/supabase.js initializes client cleanly',
    fs.existsSync(path.join(projectRoot, 'js/supabase.js')) &&
    fs.readFileSync(path.join(projectRoot, 'js/supabase.js'), 'utf8').includes('createClient'));

  let supabase = null;
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    assertTest('Supabase SDK createClient executes without runtime exceptions', Boolean(supabase));
  } catch (err) {
    assertTest('Supabase SDK createClient executes without runtime exceptions', false, err.message);
    process.exit(1);
  }

  // 2. Authentication & Session Handling
  console.log('\n--- 2. Authentication & Session Handling Verification ---');
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    assertTest('auth.getSession connects to auth server without network failure', !sessionErr, sessionErr?.message);
    assertTest('Unauthenticated session returns null/empty user gracefully', sessionData?.session === null);

    // Test sign in failure with invalid credentials returns expected structured error
    const { error: invalidLoginErr } = await supabase.auth.signInWithPassword({
      email: 'nonexistent_test_user@healthstudio.local',
      password: 'invalid_password_attempt_123'
    });
    assertTest('auth.signInWithPassword handles invalid login with structured error response',
      Boolean(invalidLoginErr && invalidLoginErr.message), invalidLoginErr?.message);
  } catch (err) {
    assertTest('Auth service verification', false, err.message);
  }

  // 3. Database Connectivity & Schema Accessibility
  console.log('\n--- 3. Database Connectivity & Core Table Verification ---');
  const coreTables = [
    'profiles',
    'specialist_profiles',
    'consultations',
    'chat_messages',
    'case_files',
    'case_notes',
    'health_profiles',
    'appointments',
    'notifications',
    'articles',
    'events'
  ];

  for (const table of coreTables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      assertTest(`Core table "${table}" is accessible in database schema`,
        !error, error ? error.message : `Accessible (${data?.length || 0} rows)`);
    } catch (e) {
      assertTest(`Core table "${table}" is accessible in database schema`, false, e.message);
    }
  }

  // 4. Clinical Columns Verification (Phase 6 Migration Contracts)
  console.log('\n--- 4. Clinical Entities & Phase 6 Migration Verification ---');
  try {
    const { error: consultColsErr } = await supabase.from('consultations')
      .select('prescription, report, structured_prescription').limit(1);
    assertTest('consultations table supports prescription, report, and structured_prescription columns',
      !consultColsErr, consultColsErr?.message);

    const { error: notesColsErr } = await supabase.from('case_notes')
      .select('medications, diagnosis, status, instructions').limit(1);
    assertTest('case_notes table supports medications (JSONB), diagnosis, status, and instructions columns',
      !notesColsErr, notesColsErr?.message);
  } catch (e) {
    assertTest('Clinical columns verification', false, e.message);
  }

  // 5. Security & Row Level Security (RLS) Enforcement
  console.log('\n--- 5. Security & RLS Defense Verification ---');
  try {
    // 5.1 Sensitive medical records not readable by anonymous caller
    const { data: anonHP } = await supabase.from('health_profiles').select('*');
    assertTest('RLS protects health_profiles: anonymous caller receives 0 rows',
      Array.isArray(anonHP) && anonHP.length === 0);

    const { data: anonCN } = await supabase.from('case_notes').select('*');
    assertTest('RLS protects case_notes: anonymous caller receives 0 rows',
      Array.isArray(anonCN) && anonCN.length === 0);

    const { data: anonCons } = await supabase.from('consultations').select('*');
    assertTest('RLS protects consultations: anonymous caller receives 0 rows',
      Array.isArray(anonCons) && anonCons.length === 0);

    const { data: anonAppts } = await supabase.from('appointments').select('*');
    assertTest('RLS protects appointments: anonymous caller receives 0 rows',
      Array.isArray(anonAppts) && anonAppts.length === 0);

    // 5.2 Anonymous insertions to clinical tables must be blocked by RLS
    const { error: anonInsertHP } = await supabase.from('health_profiles').insert({ blood_type: 'AB+' });
    assertTest('RLS rejects unauthorized anonymous insert into health_profiles',
      Boolean(anonInsertHP), anonInsertHP?.message);

    const { error: anonInsertCN } = await supabase.from('case_notes').insert({ content: 'Unauthorized prescription' });
    assertTest('RLS rejects unauthorized anonymous insert into case_notes',
      Boolean(anonInsertCN), anonInsertCN?.message);
  } catch (e) {
    assertTest('RLS defense verification', false, e.message);
  }

  // 6. Secret Exposure Check
  console.log('\n--- 6. Secret Leakage & Exposure Audit ---');
  function findSecretLeaks(dir) {
    let leaks = [];
    for (const item of fs.readdirSync(dir)) {
      if (item === 'node_modules' || item === '.git' || item === '.gemini') continue;
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        leaks = leaks.concat(findSecretLeaks(full));
      } else if (item.endsWith('.html') || item.endsWith('.js') || item.endsWith('.css') || item.endsWith('.json')) {
        const text = fs.readFileSync(full, 'utf8');
        // Check for service_role strings
        if (text.includes('service_role') && !full.includes('test_') && !full.includes('audit_') && !full.includes('.sql')) {
          leaks.push({ file: full, issue: 'Contains service_role reference' });
        }
      }
    }
    return leaks;
  }

  const leaks = findSecretLeaks(projectRoot);
  assertTest('No Supabase service-role keys exposed in client-facing HTML/JS code',
    leaks.length === 0, leaks.map(l => l.file).join(', '));

  console.log('\n================================================================');
  console.log(`TOTAL CONFIGURATION & SECURITY TESTS: ${testResults.total}`);
  console.log(`PASSED: ${testResults.passed}`);
  console.log(`FAILED: ${testResults.failed}`);
  console.log('================================================================\n');

  fs.writeFileSync(
    path.join(projectRoot, 'audit_report.json'),
    JSON.stringify(testResults, null, 2),
    'utf8'
  );

  if (testResults.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit();
