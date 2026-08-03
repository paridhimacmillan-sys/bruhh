type SmsVariables = Record<string, string>;

async function sendMsg91(templateId: string | undefined, phone: string, variables: SmsVariables, fallbackMessage: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;

  if (!authKey || !templateId) {
    console.info(`[StubbleX SMS demo] ${phone}: ${fallbackMessage}`);
    return;
  }

  const response = await fetch("https://control.msg91.com/api/v5/flow", {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: authKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      template_id: templateId,
      short_url: "0",
      recipients: [{ mobiles: `91${phone}`, ...variables }],
    }),
  });

  if (!response.ok) {
    throw new Error(`MSG91 request failed with status ${response.status}`);
  }
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  await sendMsg91(
    process.env.MSG91_OTP_TEMPLATE_ID,
    phone,
    { OTP: code, VAR1: code },
    `Your OTP is ${code}. It expires in 5 minutes.`,
  );
}

export async function sendFarmerPaidSms(input: {
  phone: string;
  weight: number;
  amount: number;
  shortlink: string;
}): Promise<void> {
  const amount = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(input.amount);
  const weight = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(input.weight);
  const message = `StubbleX: Tuhada ${weight} tonne parali vikeya — ₹${amount} FPO khaate vich aa gaye. Raseed: ${input.shortlink}`;

  await sendMsg91(
    process.env.MSG91_FARMER_TEMPLATE_ID,
    input.phone,
    {
      weight,
      amount,
      shortlink: input.shortlink,
      VAR1: weight,
      VAR2: amount,
      VAR3: input.shortlink,
    },
    message,
  );
}

export async function sendOnboardingDecisionSms(input: {
  phone: string;
  name: string;
  reference: string;
  status: "approved" | "rejected" | "documents_pending" | "waitlisted";
}): Promise<void> {
  const messages = {
    approved: `StubbleX: ${input.name}, your application ${input.reference} is approved. Approved partners can now use OTP login.`,
    rejected: `StubbleX: Your application ${input.reference} could not be approved. Contact the StubbleX team for details.`,
    documents_pending: `StubbleX: More documents are needed for application ${input.reference}. Please contact the StubbleX team.`,
    waitlisted: `StubbleX: Application ${input.reference} is on the waitlist. We will contact you when capacity opens.`,
  } as const;
  const message = messages[input.status];
  await sendMsg91(
    process.env.MSG91_ONBOARDING_TEMPLATE_ID,
    input.phone,
    { name: input.name, reference: input.reference, status: input.status, VAR1: input.name, VAR2: input.reference, VAR3: input.status },
    message,
  );
}
