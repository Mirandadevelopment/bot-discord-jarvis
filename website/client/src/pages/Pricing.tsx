import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PLANS = [
  {
    id: "monthly",
    name: "Monthly",
    description: "Perfect for getting started",
    price: "$29.99",
    period: "/month",
    features: [
      "1 bot instance",
      "30 days license",
      "Email support",
      "Basic analytics",
    ],
  },
  {
    id: "quarterly",
    name: "Quarterly",
    description: "Most popular",
    price: "$79.99",
    period: "/3 months",
    features: [
      "1 bot instance",
      "90 days license",
      "Priority email support",
      "Advanced analytics",
      "License transfer",
    ],
    popular: true,
  },
  {
    id: "semi_annual",
    name: "Semi-Annual",
    description: "Save 17%",
    price: "$149.99",
    period: "/6 months",
    features: [
      "1 bot instance",
      "180 days license",
      "Priority support",
      "Advanced analytics",
      "License transfer",
      "Custom branding",
    ],
  },
  {
    id: "annual",
    name: "Annual",
    description: "Best value - Save 33%",
    price: "$259.99",
    period: "/year",
    features: [
      "1 bot instance",
      "365 days license",
      "24/7 priority support",
      "Advanced analytics",
      "License transfer",
      "Custom branding",
      "API access",
    ],
  },
];

export default function Pricing() {
  const { user, isAuthenticated } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const createCheckoutMutation = trpc.payments.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
        toast.success("Redirecting to checkout...");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create checkout");
    },
  });

  const handleSelectPlan = (planId: string) => {
    if (!isAuthenticated) {
      toast.error("Please log in to purchase a license");
      return;
    }

    setSelectedPlan(planId);
    createCheckoutMutation.mutate({
      planType: planId as "monthly" | "quarterly" | "semi_annual" | "annual",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-muted-foreground mb-2">
          Choose the perfect plan for your bot license
        </p>
        <p className="text-muted-foreground">
          All plans include automatic renewal and license management
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                plan.popular ? "ring-2 ring-blue-500 md:scale-105" : ""
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  Most Popular
                </Badge>
              )}

              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-6">
                {/* Price */}
                <div>
                  <div className="text-3xl font-bold">
                    {plan.price}
                    <span className="text-lg text-muted-foreground font-normal">
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={selectedPlan === plan.id && createCheckoutMutation.isPending}
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  {selectedPlan === plan.id && createCheckoutMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Get Started"
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 py-16 border-t">
        <h2 className="text-2xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-2">Can I change my plan later?</h3>
            <p className="text-muted-foreground">
              Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
            <p className="text-muted-foreground">
              We accept all major credit and debit cards through Stripe, including Visa, Mastercard, and American Express.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Is there a free trial?</h3>
            <p className="text-muted-foreground">
              We don't offer a free trial, but all plans come with a 7-day money-back guarantee if you're not satisfied.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
            <p className="text-muted-foreground">
              Yes! You can cancel your subscription at any time from your dashboard. Your license will remain active until the end of your billing period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
