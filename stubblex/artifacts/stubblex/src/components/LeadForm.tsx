import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useCreateOnboardingApplication, useOnboardingRequestOtp, useOnboardingVerifyOtp, type OnboardingDocumentUpload } from "@workspace/api-client-react";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^[+]?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  email: z.string().email("Enter the Google account email").optional().or(z.literal("")),
  district: z.string().min(2, "District is required"),
  applicantType: z.enum(["farmer", "machine_partner", "logistics_operator", "buyer"]),
  organizationName: z.string().optional(),
  village: z.string().optional(),
  acres: z.coerce.number().optional(),
  expectedTonnes: z.coerce.number().optional(),
  machineType: z.enum(["baler", "rake", "tractor", "loader", "truck", "other"]).optional(),
  machineCount: z.coerce.number().optional(),
  serviceRadiusKm: z.coerce.number().optional(),
  availabilityWindow: z.string().optional(),
}).superRefine((values, context) => {
  if (values.applicantType === "farmer") {
    if (!values.village?.trim()) context.addIssue({ code: "custom", path: ["village"], message: "Village is required" });
    if (!values.expectedTonnes || values.expectedTonnes <= 0) context.addIssue({ code: "custom", path: ["expectedTonnes"], message: "Enter the approximate tonnes available" });
  }
  if (values.applicantType === "buyer") {
    if (!values.organizationName?.trim()) context.addIssue({ code: "custom", path: ["organizationName"], message: "Company name is required" });
    if (!values.expectedTonnes || values.expectedTonnes <= 0) context.addIssue({ code: "custom", path: ["expectedTonnes"], message: "Enter required tonnes" });
  }
  if (values.applicantType === "machine_partner" || values.applicantType === "logistics_operator") {
    if (!values.email?.trim()) context.addIssue({ code: "custom", path: ["email"], message: "Google account email is required for dashboard access" });
    if (!values.machineType) context.addIssue({ code: "custom", path: ["machineType"], message: "Choose a machine type" });
    if (!values.machineCount || values.machineCount <= 0) context.addIssue({ code: "custom", path: ["machineCount"], message: "Enter the number of machines" });
    if (!values.serviceRadiusKm || values.serviceRadiusKm <= 0) context.addIssue({ code: "custom", path: ["serviceRadiusKm"], message: "Enter service radius" });
    if (!values.availabilityWindow?.trim()) context.addIssue({ code: "custom", path: ["availabilityWindow"], message: "Enter availability dates" });
  }
});

type FormValues = z.infer<typeof formSchema>;

export function LeadForm() {
  const { text } = useLanguage();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      district: "Sangrur",
      applicantType: "farmer",
      organizationName: "",
      village: "",
      availabilityWindow: "",
    },
  });
  const applicantType = form.watch("applicantType");
  const createApplication = useCreateOnboardingApplication();
  const requestOtp = useOnboardingRequestOtp();
  const verifyOtp = useOnboardingVerifyOtp();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [documents, setDocuments] = useState<OnboardingDocumentUpload[]>([]);

  async function readDocuments(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, 3);
    if (selected.some((file) => file.size > 2_097_152)) {
      form.setError("root", { message: "Each document must be 2 MB or smaller" });
      return;
    }
    const encoded = await Promise.all(selected.map(async (file) => ({
      documentType: applicantType === "farmer" ? "farmer_identity_or_land_record" : applicantType === "buyer" ? "business_or_gst_document" : "machine_or_vehicle_document",
      fileName: file.name,
      mimeType: file.type as OnboardingDocumentUpload["mimeType"],
      sizeBytes: file.size,
      fileDataBase64: await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }),
    })));
    setDocuments(encoded);
  }

  async function onSubmit(values: FormValues) {
    const applicationData: Record<string, string | number | null> = {};
    if (values.organizationName?.trim()) applicationData.organizationName = values.organizationName.trim();
    if (values.village?.trim()) applicationData.village = values.village.trim();
    if (values.acres) applicationData.acres = values.acres;
    if (values.expectedTonnes) applicationData.expectedTonnes = values.expectedTonnes;
    if (values.machineType) applicationData.machineType = values.machineType;
    if (values.machineCount) applicationData.machineCount = values.machineCount;
    if (values.serviceRadiusKm) applicationData.serviceRadiusKm = values.serviceRadiusKm;
    if (values.availabilityWindow?.trim()) applicationData.availabilityWindow = values.availabilityWindow.trim();
    if (values.email?.trim()) applicationData.email = values.email.trim().toLowerCase();

    if (!otpSent || otp.length !== 6) {
      form.setError("root", { message: "Send and enter the 6-digit phone verification OTP" });
      return;
    }
    const verification = await verifyOtp.mutateAsync({ data: { phone: values.phone.replace(/\D/g, "").replace(/^91(?=[6-9][0-9]{9}$)/, ""), code: otp } });
    createApplication.mutate({
      data: {
        applicantType: values.applicantType,
        name: values.name.trim(),
        phone: values.phone,
        district: values.district.trim(),
        applicationData,
        verificationToken: verification.verificationToken,
        documents,
      },
    });
  }

  if (createApplication.isSuccess) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h3 className="mt-5 text-2xl">{text("Application received", "ਅਰਜ਼ੀ ਮਿਲ ਗਈ", "आवेदन मिल गया")}</h3>
        <p className="mt-3 text-base text-muted-foreground">
          {text(
            "We normally call within 2 working days. For farmers, an UnpackOS field operator will arrange a farm visit; a decision is usually shared within 3–5 working days after the visit, depending on local capacity and buyer demand.",
            "ਅਸੀਂ ਆਮ ਤੌਰ 'ਤੇ 2 ਕੰਮਕਾਜੀ ਦਿਨਾਂ ਵਿੱਚ ਫ਼ੋਨ ਕਰਦੇ ਹਾਂ। ਕਿਸਾਨ ਲਈ UnpackOS ਫ਼ੀਲਡ ਓਪਰੇਟਰ ਖੇਤ ਦਾ ਦੌਰਾ ਤੈਅ ਕਰੇਗਾ; ਦੌਰੇ ਤੋਂ ਬਾਅਦ ਆਮ ਤੌਰ 'ਤੇ 3–5 ਕੰਮਕਾਜੀ ਦਿਨਾਂ ਵਿੱਚ ਫ਼ੈਸਲਾ ਦੱਸਿਆ ਜਾਂਦਾ ਹੈ, ਜੋ ਸਥਾਨਕ ਸਮਰੱਥਾ ਅਤੇ ਖਰੀਦਦਾਰ ਦੀ ਮੰਗ ਉੱਤੇ ਨਿਰਭਰ ਹੈ।",
            "हम आम तौर पर 2 कार्य दिवस में फ़ोन करते हैं। किसान के लिए UnpackOS फील्ड ऑपरेटर खेत का दौरा तय करेगा; दौरे के बाद आम तौर पर 3–5 कार्य दिवस में निर्णय बताया जाता है, जो स्थानीय क्षमता और खरीदार की मांग पर निर्भर है।",
          )}
        </p>
        <div className="mx-auto mt-5 max-w-sm rounded-md border border-border bg-secondary/60 p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Application reference</p>
          <p className="mt-1 font-mono text-lg font-semibold">{createApplication.data.reference}</p>
          <a className="mt-3 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/application-status?reference=${encodeURIComponent(createApplication.data.reference)}`}>Check application status →</a>
        </div>
        <Button variant="outline" className="mt-8" onClick={() => { createApplication.reset(); form.reset(); setOtpSent(false); setOtp(""); setDocuments([]); }}>
          {text("Submit another application", "ਹੋਰ ਅਰਜ਼ੀ ਭੇਜੋ", "दूसरा आवेदन भेजें")}
        </Button>
      </div>
    );
  }

  const machineApplication = applicantType === "machine_partner" || applicantType === "logistics_operator";

  return (
    <div className="rounded-lg border border-border bg-card p-6 md:p-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField control={form.control} name="applicantType" render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>{text("I want to join as…", "ਮੈਂ ਇਸ ਤਰ੍ਹਾਂ ਜੁੜਨਾ ਚਾਹੁੰਦਾ/ਚਾਹੁੰਦੀ ਹਾਂ…", "मैं इस रूप में जुड़ना चाहता/चाहती हूँ…")}</FormLabel>
              <FormControl>
                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid gap-3 sm:grid-cols-2">
                  {[
                    { value: "farmer", label: text("Farmer / FPO", "ਕਿਸਾਨ / FPO", "किसान / FPO") },
                    { value: "machine_partner", label: text("Machine owner / aggregator", "ਮਸ਼ੀਨ ਮਾਲਕ / ਐਗਰੀਗੇਟਰ", "मशीन मालिक / एग्रीगेटर") },
                    { value: "logistics_operator", label: text("Logistics operator", "ਲਾਜਿਸਟਿਕਸ ਓਪਰੇਟਰ", "लॉजिस्टिक्स ऑपरेटर") },
                    { value: "buyer", label: text("Industrial buyer", "ਉਦਯੋਗਿਕ ਖਰੀਦਦਾਰ", "औद्योगिक खरीदार") },
                  ].map((role) => (
                    <FormItem key={role.value} className="flex items-center space-x-3 space-y-0 rounded-md border border-border p-3 shadow-sm hover-elevate">
                      <FormControl><RadioGroupItem value={role.value} /></FormControl>
                      <FormLabel className="w-full cursor-pointer font-normal">{role.label}</FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <div className="grid gap-6 sm:grid-cols-2">
            <TextField form={form} name="name" label={text("Name", "ਨਾਮ", "नाम")} placeholder="Gurpreet Singh" />
            <TextField form={form} name="phone" label={text("Phone", "ਫ਼ੋਨ", "फ़ोन")} placeholder="+91 98765 43210" type="tel" />
            <TextField form={form} name="district" label={text("District", "ਜ਼ਿਲ੍ਹਾ", "ज़िला")} placeholder="Sangrur" />
            {(applicantType === "farmer" || applicantType === "buyer") && (
              <TextField form={form} name="organizationName" label={applicantType === "buyer" ? text("Company name", "ਕੰਪਨੀ ਦਾ ਨਾਮ", "कंपनी का नाम") : text("FPO name (optional)", "FPO ਦਾ ਨਾਮ (ਚੋਣਵਾਂ)", "FPO का नाम (वैकल्पिक)")} placeholder={applicantType === "buyer" ? "GreenFuel Punjab" : "Sunam Kisan FPO"} />
            )}
            {applicantType === "farmer" && <>
              <TextField form={form} name="village" label={text("Village", "ਪਿੰਡ", "गाँव")} placeholder="Gharachon" />
              <TextField form={form} name="expectedTonnes" label={text("Approximate stubble available (tonnes)", "ਲਗਭਗ ਉਪਲਬਧ ਪਰਾਲੀ (ਟਨ)", "लगभग उपलब्ध पराली (टन)")} placeholder="10" type="number" />
              <div className="rounded-md border border-straw bg-straw/30 p-4 text-sm leading-relaxed text-straw-foreground sm:col-span-2">{text("Give your best approximate quantity. The field operator will verify it during the visit, and the weighbridge records the final payable weight. If you later have more stubble or add another field, call your assigned field operator to update the listing.","ਆਪਣਾ ਸਭ ਤੋਂ ਵਧੀਆ ਲਗਭਗ ਅੰਦਾਜ਼ਾ ਦਿਓ। ਫ਼ੀਲਡ ਓਪਰੇਟਰ ਦੌਰੇ ਦੌਰਾਨ ਇਸਦੀ ਜਾਂਚ ਕਰੇਗਾ ਅਤੇ ਅੰਤਿਮ ਭੁਗਤਾਨਯੋਗ ਵਜ਼ਨ ਵੇਅਬ੍ਰਿਜ ਉੱਤੇ ਦਰਜ ਹੋਵੇਗਾ। ਬਾਅਦ ਵਿੱਚ ਹੋਰ ਪਰਾਲੀ ਜਾਂ ਹੋਰ ਖੇਤ ਮਿਲੇ ਤਾਂ ਲਿਸਟਿੰਗ ਅਪਡੇਟ ਕਰਨ ਲਈ ਆਪਣੇ ਫ਼ੀਲਡ ਓਪਰੇਟਰ ਨੂੰ ਫ਼ੋਨ ਕਰੋ।","अपना सबसे अच्छा अनुमान दें। फील्ड ऑपरेटर दौरे में इसकी जाँच करेगा और अंतिम भुगतान योग्य वज़न वेब्रिज पर दर्ज होगा। बाद में अधिक पराली या दूसरा खेत मिले तो लिस्टिंग अपडेट करने के लिए अपने फील्ड ऑपरेटर को फ़ोन करें।")}</div>
            </>}
            {applicantType === "buyer" && <TextField form={form} name="expectedTonnes" label={text("Volume needed (tonnes)", "ਲੋੜੀਂਦੀ ਮਾਤਰਾ (ਟਨ)", "आवश्यक मात्रा (टन)")} placeholder="500" type="number" />}
            {machineApplication && <>
              <TextField form={form} name="email" label={text("Google account email", "Google ਖਾਤੇ ਦੀ ਈਮੇਲ", "Google खाते का ईमेल")} placeholder="operator@gmail.com" type="email" />
              <FormField control={form.control} name="machineType" render={({ field }) => (
                <FormItem><FormLabel>{text("Primary machine", "ਮੁੱਖ ਮਸ਼ੀਨ", "मुख्य मशीन")}</FormLabel><FormControl>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={field.value ?? ""} onChange={field.onChange}>
                    <option value="">Choose machine</option><option value="baler">Baler</option><option value="rake">Rake</option><option value="tractor">Tractor</option><option value="loader">Loader</option><option value="truck">Truck</option><option value="other">Other</option>
                  </select>
                </FormControl><FormMessage /></FormItem>
              )} />
              <TextField form={form} name="machineCount" label={text("Number of machines", "ਮਸ਼ੀਨਾਂ ਦੀ ਗਿਣਤੀ", "मशीनों की संख्या")} placeholder="2" type="number" />
              <TextField form={form} name="serviceRadiusKm" label={text("Service radius (km)", "ਸੇਵਾ ਦਾ ਘੇਰਾ (ਕਿਮੀ)", "सेवा क्षेत्र (किमी)")} placeholder="50" type="number" />
              <TextField form={form} name="availabilityWindow" label={text("Availability", "ਉਪਲਬਧਤਾ", "उपलब्धता")} placeholder="15 Oct – 30 Nov" />
            </>}
          </div>

          <div className="rounded-md border border-border bg-secondary/35 p-4">
            <p className="text-sm font-medium">Phone verification</p>
            <p className="mt-1 text-xs text-muted-foreground">We verify the applicant’s mobile before accepting the application.</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" variant="outline" disabled={requestOtp.isPending} onClick={async () => {
                const phone = form.getValues("phone").replace(/\D/g, "").replace(/^91(?=[6-9][0-9]{9}$)/, "");
                await requestOtp.mutateAsync({ data: { phone } }); setOtpSent(true);
              }}>{otpSent ? "Resend OTP" : "Send OTP"}</Button>
              {otpSent && <Input aria-label="Verification OTP" inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="6-digit OTP" />}
            </div>
          </div>
          <label className="block rounded-md border border-dashed border-border p-4 text-sm">
            <span className="font-medium">Verification documents (optional)</span>
            <span className="mt-1 block text-xs text-muted-foreground">Up to 3 PDF, JPG or PNG files · maximum 2 MB each. Farmers may also give documents to the field operator during the visit.</span>
            <Input className="mt-3" type="file" multiple accept="application/pdf,image/jpeg,image/png" onChange={(event) => void readDocuments(event.target.files)} />
            {documents.length > 0 && <span className="mt-2 block text-xs text-primary">{documents.length} document(s) ready</span>}
          </label>
          {(form.formState.errors.root?.message || requestOtp.isError || verifyOtp.isError || createApplication.isError) && <p role="alert" className="text-sm text-destructive">{form.formState.errors.root?.message || "We could not complete verification or submit the application. Please try again."}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={createApplication.isPending || verifyOtp.isPending}>{createApplication.isPending || verifyOtp.isPending ? text("Submitting…", "ਭੇਜ ਰਹੇ ਹਾਂ…", "भेज रहे हैं…") : text("Verify & submit application", "ਜਾਂਚ ਕਰੋ ਅਤੇ ਅਰਜ਼ੀ ਭੇਜੋ", "सत्यापित करें और आवेदन भेजें")}</Button>
        </form>
      </Form>
    </div>
  );
}

function TextField({ form, name, label, placeholder, type = "text" }: { form: ReturnType<typeof useForm<FormValues>>; name: keyof FormValues; label: string; placeholder: string; type?: string }) {
  return <FormField control={form.control} name={name} render={({ field }) => (
    <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type={type} inputMode={type === "number" ? "decimal" : type === "tel" ? "tel" : undefined} placeholder={placeholder} {...field} value={field.value == null ? "" : String(field.value)} /></FormControl><FormMessage /></FormItem>
  )} />;
}
