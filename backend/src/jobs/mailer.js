import nodemailer from 'nodemailer';
export async function sendBudgetAlert(email, name, category, spentCents, budgetCents) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS || !email) return false;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER, to: email,
    subject: `Budget alert: ${category}`,
    text: `Hi ${name}, your spending in ${category} has reached ${(spentCents / 100).toFixed(2)}, against a budget of ${(budgetCents / 100).toFixed(2)}.`
  });
  return true;
}
