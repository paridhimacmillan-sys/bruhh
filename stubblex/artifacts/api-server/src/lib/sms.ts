type SmsVariables = Record<string, string>;

async function sendMsg91(templateId: string | undefined, phone: string, variables: SmsVariables, fallbackMessage: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;

  if (!authKey || !templateId) {
    console.info(`[Unpackos SMS demo] ${phone}: ${fallbackMessage}`);
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
  const message = `Unpackos: Tuhada ${weight} tonne parali vikeya — ₹${amount} FPO khaate vich aa gaye. Raseed: ${input.shortlink}`;

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
    approved: `Unpackos: ${input.name}, your application ${input.reference} is approved. Approved partners can now use OTP login.`,
    rejected: `Unpackos: Your application ${input.reference} could not be approved. Contact the Unpackos team for details.`,
    documents_pending: `Unpackos: More documents are needed for application ${input.reference}. Please contact the Unpackos team.`,
    waitlisted: `Unpackos: Application ${input.reference} is on the waitlist. We will contact you when capacity opens.`,
  } as const;
  const message = messages[input.status];
  await sendMsg91(
    process.env.MSG91_ONBOARDING_TEMPLATE_ID,
    input.phone,
    { name: input.name, reference: input.reference, status: input.status, VAR1: input.name, VAR2: input.reference, VAR3: input.status },
    message,
  );
}

export async function sendFarmerEnrollmentSms(input: {
  phone: string;
  name: string;
  reference: string;
  operatorName: string;
  operatorPhone: string;
  listedTonnes: number;
}): Promise<void> {
  const tonnes = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(input.listedTonnes);
  const message = `Unpackos: ${input.name}, tuhadi ${tonnes} tonne parali listing manzoor hai. Field operator: ${input.operatorName} ${input.operatorPhone}. Hor parali hove ta operator nu call karo. Ref: ${input.reference}`;
  await sendMsg91(
    process.env.MSG91_FARMER_APPROVAL_TEMPLATE_ID,
    input.phone,
    { name: input.name, tonnes, operatorName: input.operatorName, operatorPhone: input.operatorPhone, reference: input.reference, VAR1: tonnes, VAR2: input.operatorName, VAR3: input.operatorPhone },
    message,
  );
}

export async function sendFarmerQuantityUpdatedSms(input: {
  phone: string;
  additionalTonnes: number;
  totalTonnes: number;
}): Promise<void> {
  const additional = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(input.additionalTonnes);
  const total = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(input.totalTonnes);
  const message = `Unpackos: Tuhadi parali listing ${additional} tonne vadha ditti gayi. Nava total: ${total} tonne. Antim bhugtan weighbridge de asal wazan te hovega.`;
  await sendMsg91(
    process.env.MSG91_QUANTITY_UPDATE_TEMPLATE_ID,
    input.phone,
    { additional, total, VAR1: additional, VAR2: total },
    message,
  );
}
