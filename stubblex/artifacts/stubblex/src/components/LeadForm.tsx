import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import { useCreateLead } from "@workspace/api-client-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  phone: z.string().regex(/^[+]?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  role: z.enum(["farmer", "buyer", "operator"], {
    required_error: "Please select a role",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export function LeadForm() {
  const { text } = useLanguage();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const createLead = useCreateLead();

  function onSubmit(data: FormValues) {
    createLead.mutate({ data });
  }

  if (createLead.isSuccess) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h3 className="mt-5 text-2xl">{text("Message received", "ਸੁਨੇਹਾ ਮਿਲ ਗਿਆ", "संदेश मिल गया")}</h3>
        <p className="mt-3 text-base text-muted-foreground">
          {text("Thank you for reaching out. A team member will be in touch shortly to discuss the upcoming harvest season.", "ਸੰਪਰਕ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਆਉਣ ਵਾਲੇ ਵਾਢੀ ਸੀਜ਼ਨ ਬਾਰੇ ਗੱਲ ਕਰਨ ਲਈ ਸਾਡੀ ਟੀਮ ਜਲਦੀ ਸੰਪਰਕ ਕਰੇਗੀ।", "संपर्क करने के लिए धन्यवाद। आगामी कटाई सीज़न पर बात करने के लिए हमारी टीम जल्द संपर्क करेगी।")}
        </p>
        <Button
          variant="outline"
          className="mt-8"
          onClick={() => {
            createLead.reset();
            form.reset();
          }}
        >
          {text("Send another message", "ਹੋਰ ਸੁਨੇਹਾ ਭੇਜੋ", "दूसरा संदेश भेजें")}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 md:p-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{text("Name", "ਨਾਮ", "नाम")}</FormLabel>
                  <FormControl>
                    <Input placeholder="Gurpreet Singh" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{text("Phone", "ਫ਼ੋਨ", "फ़ोन")}</FormLabel>
                  <FormControl>
                    <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>{text("I am a…", "ਮੈਂ ਹਾਂ…", "मैं हूँ…")}</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {[
                      { value: "farmer" as const, label: text("Farmer / FPO", "ਕਿਸਾਨ / FPO", "किसान / FPO") },
                      { value: "buyer" as const, label: text("Industrial buyer", "ਉਦਯੋਗਿਕ ਖਰੀਦਦਾਰ", "औद्योगिक खरीदार") },
                      { value: "operator" as const, label: text("Logistics operator", "ਲਾਜਿਸਟਿਕਸ ਓਪਰੇਟਰ", "लॉजिस्टिक्स ऑपरेटर") },
                    ].map((role) => (
                      <FormItem key={role.value} className="flex items-center space-x-3 space-y-0 rounded-md border border-border p-3 shadow-sm hover-elevate">
                        <FormControl>
                          <RadioGroupItem value={role.value} />
                        </FormControl>
                        <FormLabel className="w-full cursor-pointer font-normal">{role.label}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {createLead.isError && (
            <p role="alert" className="text-sm text-destructive">
              {text("We could not send your details. Please check your connection and try again.", "ਤੁਹਾਡੀ ਜਾਣਕਾਰੀ ਨਹੀਂ ਭੇਜੀ ਜਾ ਸਕੀ। ਕਨੈਕਸ਼ਨ ਜਾਂਚ ਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।", "आपकी जानकारी नहीं भेजी जा सकी। कनेक्शन जांचकर फिर कोशिश करें।")}
            </p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={createLead.isPending}>
            {createLead.isPending ? text("Sending…", "ਭੇਜ ਰਹੇ ਹਾਂ…", "भेज रहे हैं…") : text("Send message", "ਸੁਨੇਹਾ ਭੇਜੋ", "संदेश भेजें")}
          </Button>
        </form>
      </Form>
    </div>
  );
}
