import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, AlertCircle, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { toast } from "sonner";

export default function Dashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const { data: licenses, isLoading } = trpc.licenses.list.useQuery();
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success('Payment successful! Your license is now active.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">My Licenses</h1>
            <p className="text-muted-foreground">Manage your bot licenses and instances</p>
          </div>
          <Button onClick={() => navigate('/pricing')} className="gap-2">
            <Plus className="w-4 h-4" />
            Buy License
          </Button>
        </div>

        {/* Licenses Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin" />
          </div>
        ) : licenses && licenses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {licenses.map((license) => (
              <LicenseCard key={license.id} license={license} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground mb-4">No licenses yet</p>
              <Button onClick={() => navigate('/pricing')}>Get Started</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function LicenseCard({ license }: { license: any }) {
  const [, navigate] = useLocation();
  const remainingDays = Math.ceil(
    (new Date(license.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const statusColorMap: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    suspended: 'bg-red-100 text-red-800',
    expired: 'bg-red-100 text-red-800',
  };
  const statusColor = statusColorMap[license.status] || 'bg-gray-100 text-gray-800';

  const planLabelMap: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    semi_annual: 'Semi-Annual',
    annual: 'Annual',
  };
  const planLabel = planLabelMap[license.planType] || license.planType;

  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(`/licenses/${license.id}`)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{planLabel} Plan</CardTitle>
            <CardDescription>{license.licenseKey}</CardDescription>
          </div>
          <Badge className={statusColor}>{license.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expires in</span>
            <span className="font-semibold">{remainingDays} days</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Expiry Date</span>
            <span>{new Date(license.expiryDate).toLocaleDateString()}</span>
          </div>
        </div>

        {remainingDays <= 7 && remainingDays > 0 && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-md">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <span className="text-sm text-yellow-600">Expiring soon</span>
          </div>
        )}

        {license.status === 'active' && (
          <Button variant="outline" className="w-full" onClick={(e) => {
            e.stopPropagation();
            navigate(`/licenses/${license.id}`);
          }}>
            Manage
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
