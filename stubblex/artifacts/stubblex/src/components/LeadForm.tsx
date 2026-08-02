import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  organisation: z.string().optional(),
  role: z.enum(["Farmer / FPO", "Industrial buyer", "Logistics partner", "Investor / other"], {
    required_error: "Please select a role",
  }),
  email: z.string().email("Valid email is required"),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function LeadForm() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      organisation: "",
      email: "",
      message: "",
    },
  });

  function onSubmit(_data: FormValues) {
    // No real API call needed, just show success state
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center sm:p-12">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h3 className="mt-5 text-2xl">Message received</h3>
        <p className="mt-3 text-base text-muted-foreground">
          Thank you for reaching out. A team member will be in touch shortly to discuss the upcoming harvest season.
        </p>
        <Button variant="outline" className="mt-8" onClick={() => setSubmitted(false)}>
          Send another message
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
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Gurpreet Singh" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organisation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organisation (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Agri Cluster FPO" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="gurpreet@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>I am a...</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    {[
                      "Farmer / FPO",
                      "Industrial buyer",
                      "Logistics partner",
                      "Investor / other",
                    ].map((role) => (
                      <FormItem key={role} className="flex items-center space-x-3 space-y-0 rounded-md border border-border p-3 shadow-sm hover-elevate">
                        <FormControl>
                          <RadioGroupItem value={role} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer w-full">{role}</FormLabel>
                      </FormItem>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message (optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What are you working on?"
                    className="min-h-[100px] resize-y"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" size="lg">
            Send message
          </Button>
        </form>
      </Form>
    </div>
  );
}
