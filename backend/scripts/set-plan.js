// Manually change a user's plan until payments are integrated.
// Usage: npm run set-plan -- someone@example.com pro
import { auth, db } from '../src/firebase.js';
import { setPlan, PLAN_IDS } from '../src/services/users.js';

const [email, plan] = process.argv.slice(2);

if (!email || !PLAN_IDS.includes(plan)) {
  console.error(`Usage: npm run set-plan -- <email> <${PLAN_IDS.join('|')}>`);
  process.exit(1);
}
if (!auth || !db) {
  console.error('Firebase is not configured — add the service account first.');
  process.exit(1);
}

try {
  const user = await auth.getUserByEmail(email);
  await setPlan(user.uid, plan);
  console.log(`✔ ${email} is now on the ${plan} plan.`);
  process.exit(0);
} catch (err) {
  console.error(`✘ ${err.message}`);
  process.exit(1);
}
