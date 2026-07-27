import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingUp, DollarSign, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ResalePanel() {
  const { user } = useAuth();
  const [newBuyerEmail, setNewBuyerEmail] = useState("");

  const { data: licenses } = trpc.licenses.list.useQuery();
  const { data: transfers } = trpc.admin.transfers.pending.useQuery();

  const createTransferMutation = trpc.transfers.request.useMutation({
    onSuccess: () => {
      toast.success("Transfer request sent!");
      setNewBuyerEmail("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create transfer");
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  const resaleLicenses = licenses?.filter((l: any) => l.status === 'active') || [];
  const totalValue = resaleLicenses.reduce((sum: number, l: any) => {
    const priceMap: Record<string, number> = {
      monthly: 29.99,
      quarterly: 79.99,
      semi_annual: 149.99,
      annual: 259.99,
    };
    return sum + (priceMap[l.planType] || 0);
  }, 0);

  const pendingTransfers = transfers?.filter((t: any) => t.status === 'pending') || [];
  const approvedTransfers = transfers?.filter((t: any) => t.status === 'approved') || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Resale Panel</h1>
          <p className="text-muted-foreground">Manage and resell your bot licenses</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Available Licenses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{resaleLicenses.length}</p>
              <p className="text-xs text-muted-foreground">Ready to resell</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total resale value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending Transfers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pendingTransfers.length}</p>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="licenses" className="w-full">
          <TabsList>
            <TabsTrigger value="licenses">My Licenses</TabsTrigger>
            <TabsTrigger value="transfers">Transfer Requests</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          {/* Licenses Tab */}
          <TabsContent value="licenses" className="space-y-4">
            {resaleLicenses.length > 0 ? (
              <div className="space-y-4">
                {resaleLicenses.map((license: any) => {
                  const priceMap: Record<string, number> = {
                    monthly: 29.99,
                    quarterly: 79.99,
                    semi_annual: 149.99,
                    annual: 259.99,
                  };
                  const price = priceMap[license.planType] || 0;

                  return (
                    <Card key={license.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{license.licenseKey}</CardTitle>
                            <CardDescription>
                              {license.planType.charAt(0).toUpperCase() + license.planType.slice(1)} Plan
                            </CardDescription>
                          </div>
                          <Badge variant="default">${price.toFixed(2)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-2">
                          <p className="text-sm">
                            <span className="font-semibold">Expires:</span>{" "}
                            {new Date(license.expiryDate).toLocaleDateString()}
                          </p>
                          <p className="text-sm">
                            <span className="font-semibold">Status:</span> {license.status}
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            const email = prompt("Enter buyer's email:");
                            if (email) {
                              createTransferMutation.mutate({
                                licenseId: license.id,
                                toUserEmail: email,
                              });
                            }
                          }}
                          disabled={createTransferMutation.isPending}
                          className="w-full"
                        >
                          {createTransferMutation.isPending ? (
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
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No licenses available for resale</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Transfers Tab */}
          <TabsContent value="transfers" className="space-y-4">
            {pendingTransfers.length > 0 ? (
              <div className="space-y-4">
                {pendingTransfers.map((transfer: any) => (
                  <Card key={transfer.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Transfer #{transfer.id}</CardTitle>
                          <CardDescription>
                            Requested on {new Date(transfer.requestedAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Awaiting admin approval. Once approved, the license will be transferred to the new owner.
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No pending transfer requests</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {approvedTransfers.length > 0 ? (
              <div className="space-y-4">
                {approvedTransfers.map((transfer: any) => (
                  <Card key={transfer.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Transfer #{transfer.id}</CardTitle>
                          <CardDescription>
                            Approved on {transfer.approvedAt ? new Date(transfer.approvedAt).toLocaleDateString() : 'N/A'}
                          </CardDescription>
                        </div>
                        <Badge variant="default">Completed</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        License has been successfully transferred to the new owner.
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No transfer history</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
