// Single source of truth for workflow rules, shared by routes, services and seed data.

const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Reopened'];

// A grievance may only move along these edges. Anything else is rejected with HTTP 409.
const TRANSITIONS = {
  'Submitted': ['Under Review'],
  'Under Review': ['In Progress'],
  'In Progress': ['Resolved'],
  'Resolved': ['Reopened'],
  'Reopened': ['Under Review'],
};

const PRIORITIES = ['Low', 'Medium', 'High'];

// Days allowed to resolve a grievance, by priority. Used to compute due_date and "overdue".
const SLA_DAYS = { High: 7, Medium: 15, Low: 30 };

const DISTRICTS = [
  'Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam',
  'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram',
  'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod',
];

const CATEGORIES = [
  'Roads & Infrastructure', 'Healthcare', 'Education', 'Water Supply', 'Electricity',
  'Waste Management & Sanitation', 'Public Transport', 'Land & Revenue', 'Social Welfare', 'Other',
];

// Default department for each category (used by seed data and as a hint; the CMO decides).
const CATEGORY_DEPARTMENT = {
  'Roads & Infrastructure': 'Public Works Department',
  'Healthcare': 'Health & Family Welfare Department',
  'Education': 'General Education Department',
  'Water Supply': 'Kerala Water Authority',
  'Electricity': 'Kerala State Electricity Board',
  'Waste Management & Sanitation': 'Local Self Government Department',
  'Public Transport': 'Transport Department',
  'Land & Revenue': 'Revenue Department',
  'Social Welfare': 'Social Justice Department',
};

const WORK_STATUSES = ['Assigned', 'Investigating', 'ATR Submitted'];

module.exports = {
  STATUSES, TRANSITIONS, PRIORITIES, SLA_DAYS, DISTRICTS, CATEGORIES,
  CATEGORY_DEPARTMENT, WORK_STATUSES,
};
