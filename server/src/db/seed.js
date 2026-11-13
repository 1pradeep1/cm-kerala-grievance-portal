// Usage: npm run db:seed
// WARNING: wipes all data, then loads FICTIONAL demo data by driving the real service functions,
// so the demo history is produced by the same code paths the app uses.
const bcrypt = require('bcryptjs');
const { pool } = require('./pool');
const svc = require('../services/grievanceService');
const C = require('../constants');

const DEMO = {
  cmo: { email: 'cmo@cmkerala-demo.test', password: 'Cmo@12345' },
  officerPassword: 'Officer@123',
  citizenPassword: 'Citizen@123',
};

const DEPARTMENTS = [
  ['Public Works Department', 'Builds and maintains state roads, bridges and government buildings.'],
  ['Health & Family Welfare Department', 'Runs government hospitals, primary health centres and public health programmes.'],
  ['General Education Department', 'Oversees government schools, teachers, curriculum and student welfare.'],
  ['Kerala Water Authority', 'Provides drinking water supply and manages sewerage services.'],
  ['Kerala State Electricity Board', 'Generates, distributes and maintains electricity supply across the state.'],
  ['Local Self Government Department', 'Supports panchayats and municipalities, including waste management and sanitation.'],
  ['Transport Department', 'Regulates public transport, vehicle registration and road safety.'],
  ['Revenue Department', 'Handles land records, certificates, surveys and disaster relief.'],
  ['Social Justice Department', 'Delivers pensions and welfare schemes for senior citizens, women, children and the differently abled.'],
];
const OFFICER_KEYS = ['pwd', 'health', 'education', 'water', 'kseb', 'lsgd', 'transport', 'revenue', 'socialjustice'];

const CITIZENS = [
  ['Anjali Menon', 'anjali@cmkerala-demo.test', '9847012345'],
  ['Rahul Nair', 'rahul@cmkerala-demo.test', '9895123456'],
  ['Fathima Beevi', 'fathima@cmkerala-demo.test', '9946234567'],
  ['Joseph Thomas', 'joseph@cmkerala-demo.test', '9744345678'],
];

// stage: submitted | review | progress | atr | resolved | rated | reopened | escalated
// daysAgo moves every timestamp back so the dashboard shows realistic ages and overdue items.
const GRIEVANCES = [
  [0, 'Thiruvananthapuram', 'Roads & Infrastructure', 'High', 'rated', 20, 'Large pothole near Kesavadasapuram junction', 'A deep pothole near the junction has caused several two-wheeler accidents this month. It fills with water in the rain and cannot be seen at night.'],
  [1, 'Ernakulam', 'Waste Management & Sanitation', 'Medium', 'progress', 6, 'Garbage not collected for two weeks in ward 14', 'Door-to-door waste collection has stopped in our ward for two weeks and waste is piling up near the market road, causing a bad smell.'],
  [2, 'Kozhikode', 'Healthcare', 'High', 'atr', 5, 'No doctor available at primary health centre in the evening', 'The PHC near our village has no doctor after 2 PM. Patients with fever and injuries have to travel 20 km to the taluk hospital.'],
  [3, 'Thrissur', 'Water Supply', 'Medium', 'submitted', 1, 'Low water pressure in our colony for a month', 'Houses on the upper side of our colony get almost no water in the morning. The Water Authority tap connection has been affected since last month.'],
  [0, 'Alappuzha', 'Electricity', 'High', 'escalated', 16, 'Repeated power cuts affecting small businesses', 'Our area faces power cuts of 3 to 4 hours almost daily. Several small shops and a bakery are losing business because of this.'],
  [1, 'Kollam', 'Education', 'Low', 'resolved', 25, 'Broken benches in government high school classrooms', 'Many benches in classes 8 and 9 are broken and students are sitting on the floor. Please arrange repair or replacement.'],
  [2, 'Malappuram', 'Public Transport', 'Medium', 'review', 3, 'KSRTC bus service to hill village stopped', 'The only morning bus to our hill village was stopped two months ago. School children now walk 5 km to the main road.'],
  [3, 'Palakkad', 'Land & Revenue', 'Medium', 'progress', 10, 'Delay in issuing possession certificate', 'I applied for a possession certificate at the village office six weeks ago and have not received it. My loan application depends on it.'],
  [0, 'Kannur', 'Social Welfare', 'High', 'reopened', 18, 'Old age pension not received for three months', 'My 78-year-old mother has not received her social security pension for three months. She depends on it for her medicines.'],
  [1, 'Wayanad', 'Roads & Infrastructure', 'Medium', 'rated', 22, 'Landslide debris blocking village road', 'Debris from a small landslide is still blocking the village road after the rains. Ambulances cannot reach us.'],
  [2, 'Kottayam', 'Water Supply', 'High', 'progress', 12, 'Contaminated drinking water from public tap', 'Water from the public tap near the bus stand is muddy and smells bad. Several children in the area have stomach problems.'],
  [3, 'Ernakulam', 'Healthcare', 'Medium', 'submitted', 0, 'Long waiting time for scan at district hospital', 'The ultrasound scan appointment at the district hospital is given after two months. Please increase scanning capacity.'],
  [0, 'Idukki', 'Electricity', 'Low', 'resolved', 28, 'Street light not working near school', 'The street light outside the government school has not worked for weeks, making the road unsafe for children in the evening.'],
  [1, 'Kasaragod', 'Education', 'Medium', 'submitted', 2, 'Shortage of teachers in government LP school', 'Our LP school has only two teachers for four classes. Studies of the children are suffering badly.'],
  [2, 'Pathanamthitta', 'Roads & Infrastructure', 'High', 'escalated', 19, 'Damaged bridge railing on main road', 'The railing of the bridge near the temple has collapsed and nothing has been done for weeks. It is dangerous for vehicles and pedestrians.'],
  [3, 'Thiruvananthapuram', 'Waste Management & Sanitation', 'Medium', 'atr', 8, 'Open drain overflowing near market', 'The open drain beside the market overflows during rain and sewage enters shops. It needs permanent repair and a cover.'],
  [0, 'Thrissur', 'Public Transport', 'Low', 'review', 4, 'Request for bus shelter at junction', 'Many elderly people and students wait in the sun and rain at our junction. A bus shelter would help a lot.'],
  [1, 'Kozhikode', 'Land & Revenue', 'Low', 'rated', 27, 'Name correction in land tax receipt', 'My name is misspelled in the land tax receipt and I need it corrected for a bank loan.'],
  [2, 'Alappuzha', 'Social Welfare', 'Medium', 'progress', 7, 'Disability certificate pending for six months', 'My son has applied for a disability certificate and the medical board has not given a date even after six months.'],
  [3, 'Malappuram', 'Healthcare', 'High', 'submitted', 0, 'Ambulance not available at community health centre', 'The only ambulance at our community health centre has been out of service for ten days and emergency patients are suffering.'],
];

async function main() {
  console.log('Clearing existing data...');
  await pool.query(`TRUNCATE feedback, internal_remarks, grievance_history, assignments, attachments,
                    grievances, users, departments, contact_enquiries RESTART IDENTITY CASCADE`);
  await pool.query('ALTER SEQUENCE grievance_ref_seq RESTART WITH 1');

  const hash = {
    cmo: await bcrypt.hash(DEMO.cmo.password, 10),
    officer: await bcrypt.hash(DEMO.officerPassword, 10),
    citizen: await bcrypt.hash(DEMO.citizenPassword, 10),
  };

  const deptByName = {};
  for (const [name, description] of DEPARTMENTS) {
    const { rows } = await pool.query('INSERT INTO departments (name, description) VALUES ($1,$2) RETURNING id', [name, description]);
    deptByName[name] = rows[0].id;
  }

  const insertUser = async (name, email, mobile, passwordHash, role, departmentId) => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, mobile, password_hash, role, department_id)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, role, department_id`,
      [name, email, mobile, passwordHash, role, departmentId]);
    return rows[0];
  };

  const cmo = await insertUser('CMO Administrator', DEMO.cmo.email, '9000000000', hash.cmo, 'cmo', null);
  const officerByDept = {};
  for (let i = 0; i < DEPARTMENTS.length; i++) {
    const deptName = DEPARTMENTS[i][0];
    officerByDept[deptName] = await insertUser(
      `Officer, ${deptName.replace(' Department', '')}`, `officer.${OFFICER_KEYS[i]}@cmkerala-demo.test`,
      '9000000001', hash.officer, 'officer', deptByName[deptName]);
  }
  const citizens = [];
  for (const [name, email, mobile] of CITIZENS) citizens.push(await insertUser(name, email, mobile, hash.citizen, 'citizen', null));

  const atrText = 'Site inspected by the assistant engineer. Repair work completed and verified on site; photographs are on file with the department.';

  for (const [ci, district, category, priority, stage, daysAgo, subject, description] of GRIEVANCES) {
    const citizen = citizens[ci];
    const deptName = C.CATEGORY_DEPARTMENT[category];
    const officer = officerByDept[deptName];
    const g = await svc.createGrievance({ district, category, subject, description, priority }, citizen);

    const assign = () => svc.assignGrievance(g.id, {
      departmentId: deptByName[deptName], officerId: officer.id, instructions: 'Please inspect and report within the deadline.',
    }, cmo);
    const toAtr = async () => {
      await assign();
      await svc.officerUpdate(g.id, { remark: 'Site visit scheduled and investigation started.', workStatus: 'Investigating' }, officer);
      await svc.submitAtr(g.id, { atrText }, officer);
    };

    if (stage === 'review') await svc.startReview(g.id, {}, cmo);
    if (stage === 'progress') { await assign(); await svc.officerUpdate(g.id, { remark: 'Complaint received; team assigned for inspection.', workStatus: 'Investigating' }, officer); }
    if (stage === 'atr') await toAtr();
    if (stage === 'escalated') { await assign(); await svc.escalateGrievance(g.id, { remark: 'Deadline exceeded; department asked for an urgent report.' }, cmo); }
    if (['resolved', 'rated', 'reopened'].includes(stage)) {
      await toAtr();
      await svc.reviewAtr(g.id, { decision: 'accept', remark: 'Report reviewed and accepted. Issue resolved.' }, cmo);
    }
    if (stage === 'rated') await svc.addFeedback(g.id, { rating: 4, comment: 'Problem fixed, thank you for the quick action.' }, citizen);
    if (stage === 'reopened') await svc.reopenGrievance(g.id, { remark: 'The issue has returned and is not fully fixed.' }, citizen);
    if (stage === 'resolved') await svc.addInternalRemark(g.id, { remark: 'Closed after department confirmation.' }, cmo);

    if (daysAgo > 0) { // shift every timestamp of this grievance into the past
      const d = daysAgo;
      await pool.query(`UPDATE grievances SET created_at = created_at - make_interval(days => $2), updated_at = updated_at - make_interval(days => $2),
        due_date = due_date - make_interval(days => $2), resolved_at = resolved_at - make_interval(days => $2),
        escalated_at = escalated_at - make_interval(days => $2) WHERE id = $1`, [g.id, d]);
      await pool.query('UPDATE grievance_history SET created_at = created_at - make_interval(days => $2) WHERE grievance_id = $1', [g.id, d]);
      await pool.query(`UPDATE assignments SET created_at = created_at - make_interval(days => $2),
        atr_submitted_at = atr_submitted_at - make_interval(days => $2), decided_at = decided_at - make_interval(days => $2) WHERE grievance_id = $1`, [g.id, d]);
    }
  }

  const { rows } = await pool.query(`SELECT status, count(*)::int AS n FROM grievances GROUP BY status ORDER BY status`);
  console.log('Seed complete. Grievances by status:', rows.map((r) => `${r.status}=${r.n}`).join(', '));
  console.log('\nDemo logins:');
  console.log(`  CMO      ${DEMO.cmo.email} / ${DEMO.cmo.password}`);
  console.log(`  Officer  officer.pwd@cmkerala-demo.test / ${DEMO.officerPassword}  (also .health .education .water .kseb .lsgd .transport .revenue .socialjustice)`);
  console.log(`  Citizen  anjali@cmkerala-demo.test / ${DEMO.citizenPassword}`);
}

main()
  .catch((err) => { console.error('Seed failed:', err); process.exitCode = 1; })
  .finally(() => pool.end());
