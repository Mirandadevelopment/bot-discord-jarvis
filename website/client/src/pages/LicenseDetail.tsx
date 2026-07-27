import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Loader2, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function LicenseDetail() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/licenses/:id");
  const licenseId = params?.id ? parseInt(params.id) : 0;

  const { data: license, isLoading } = trpc.licenses.detail.useQuery(
    { licenseId },
    { enabled: !!licenseId }
  );

  const { data: instances } = trpc.instances.list.useQuery(
    { licenseId },
    { enabled: !!licenseId && !!license }
  );

  const [botToken, setBotToken] = useState("");
  const [serverId, setServerId] = useState("");
  const [ownerId, setOwnerId] = useState("");

  const createInstanceMutation = trpc.instances.create.useMutation({
    onSuccess: () => {
      toast.success("Instance created successfully");
      setBotToken("");
      setServerId("");
      setOwnerId("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create instance");
    },
  });

  const requestTransferMutation = trpc.transfers.request.useMutation({
    onSuccess: () => {
      toast.success("Transfer request sent to admin");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to request transfer");
    },
  });

  if (!user || !match) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!license) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">License not found</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const remainingDays = Math.ceil(
    (new Date(license.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  const planLabelMap: Record<string, string> = {
    monthly: "Monthly",
    quarterly: "Quarterly",
    semi_annual: "Semi-Annual",
    annual: "Annual",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{planLabelMap[license.planType] || license.planType} License</h1>
            <p className="text-muted-foreground">{license.licenseKey}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back
          </Button>
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge>{license.status}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{remainingDays}</p>
              <p className="text-xs text-muted-foreground">
                Expires {new Date(license.expiryDate).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Instances</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{instances?.length || 0}</p>
            </CardContent>
          </Card>
        </div>

        {remainingDays <= 7 && remainingDays > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-900">License Expiring Soon</p>
                <p className="text-sm text-yellow-700">
                  Your license will expire in {remainingDays} days. Consider renewing soon.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="instances" className="w-full">
          <TabsList>
            <TabsTrigger value="instances">Bot Instances</TabsTrigger>
            <TabsTrigger value="details">License Details</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
          </TabsList>

          {/* Instances Tab */}
          <TabsContent value="instances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create New Instance</CardTitle>
                <CardDescription>Deploy a new bot instance for your license</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="botToken">Bot Token</Label>
                    <Input
                      id="botToken"
                      type="password"
                      placeholder="Your Discord bot token"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="serverId">Server ID</Label>
                    <Input
                      id="serverId"
                      placeholder="Discord server ID"
                      value={serverId}
                      onChange={(e) => setServerId(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ownerId">Owner ID</Label>
                    <Input
                      id="ownerId"
                      placeholder="Discord owner user ID"
                      value={ownerId}
                      onChange={(e) => setOwnerId(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={() =>
                    createInstanceMutation.mutate({
                      licenseId: license.id,
                      botToken,
                      serverId,
                      ownerId,
                    })
                  }
                  disabled={!botToken || !serverId || !ownerId || createInstanceMutation.isPending}
                >
                  {createInstanceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Instance"
                  )}
                </Button>
              </CardContent>
            </Card>

            {instances && instances.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Instances</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {instances.map((instance: any) => (
                      <div key={instance.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-semibold">Server {instance.serverId}</p>
                          <p className="text-sm text-muted-foreground">Status: {instance.instanceStatus}</p>
                        </div>
                        <Badge variant={instance.instanceStatus === "running" ? "default" : "secondary"}>
                          {instance.instanceStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details">
            <Card>
              <CardHeader>
                <CardTitle>License Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label>License Key</Label>
                    <div className="flex gap-2">
                      <Input value={license.licenseKey} readOnly />
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(license.licenseKey);
                          toast.success("Copied to clipboard");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Plan Type</Label>
                    <Input value={planLabelMap[license.planType] || license.planType} readOnly />
                  </div>
                  <div>
                    <Label>Purchase Date</Label>
                    <Input value={new Date(license.purchaseDate).toLocaleDateString()} readOnly />
                  </div>
                  <div>
                    <Label>Expiry Date</Label>
                    <Input value={new Date(license.expiryDate).toLocaleDateString()} readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transfer Tab */}
          <TabsContent value="transfer">
            <Card>
              <CardHeader>
                <CardTitle>Transfer License</CardTitle>
                <CardDescription>Transfer this license to another user</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Transfer requests require admin approval. The new owner will receive a notification.
                </p>
                <Button
                  onClick={() => {
                    const email = prompt("Enter the email of the new license owner:");
                    if (email) {
                      requestTransferMutation.mutate({
                        licenseId: license.id,
                        toUserEmail: email,
                      });
                    }
                  }}
                  disabled={requestTransferMutation.isPending}
                >
                  {requestTransferMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    "Request Transfer"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
