import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: licenses, isLoading: licensesLoading } = trpc.admin.licenses.list.useQuery();
  const { data: pendingTransfers, isLoading: transfersLoading } = trpc.admin.transfers.pending.useQuery();
  const { data: auditLogs, isLoading: logsLoading } = trpc.admin.auditLogs.list.useQuery();

  const approveMutation = trpc.admin.transfers.approve.useMutation({
    onSuccess: () => {
      toast.success("Transfer approved");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to approve transfer");
    },
  });

  const rejectMutation = trpc.admin.transfers.reject.useMutation({
    onSuccess: () => {
      toast.success("Transfer rejected");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to reject transfer");
    },
  });

  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Access denied. Admin only.</p>
            <Button onClick={() => navigate("/dashboard")} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage licenses, transfers, and system activity</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="transfers" className="w-full">
          <TabsList>
            <TabsTrigger value="transfers">Pending Transfers</TabsTrigger>
            <TabsTrigger value="licenses">All Licenses</TabsTrigger>
            <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          </TabsList>

          {/* Pending Transfers Tab */}
          <TabsContent value="transfers" className="space-y-4">
            {transfersLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin" />
              </div>
            ) : pendingTransfers && pendingTransfers.length > 0 ? (
              <div className="space-y-4">
                {pendingTransfers.map((transfer: any) => (
                  <Card key={transfer.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">Transfer Request #{transfer.id}</CardTitle>
                          <CardDescription>
                            From user {transfer.fromUserId} to user {transfer.toUserId}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2">
                        <p className="text-sm">
                          <span className="font-semibold">License ID:</span> {transfer.licenseId}
                        </p>
                        <p className="text-sm">
                          <span className="font-semibold">Requested:</span>{" "}
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => approveMutation.mutate({ transferId: transfer.id })}
                          disabled={approveMutation.isPending}
                          className="gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            const reason = prompt("Rejection reason:");
                            if (reason) {
                              rejectMutation.mutate({ transferId: transfer.id, reason });
                            }
                          }}
                          disabled={rejectMutation.isPending}
                          className="gap-2"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No pending transfers</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Licenses Tab */}
          <TabsContent value="licenses" className="space-y-4">
            {licensesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin" />
              </div>
            ) : licenses && licenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">License Key</th>
                      <th className="text-left py-2 px-4">User ID</th>
                      <th className="text-left py-2 px-4">Plan</th>
                      <th className="text-left py-2 px-4">Status</th>
                      <th className="text-left py-2 px-4">Expiry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.map((license: any) => (
                      <tr key={license.id} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-4 font-mono text-xs">{license.licenseKey}</td>
                        <td className="py-2 px-4">{license.userId}</td>
                        <td className="py-2 px-4 capitalize">{license.planType}</td>
                        <td className="py-2 px-4">
                          <Badge
                            variant={
                              license.status === "active"
                                ? "default"
                                : license.status === "expired"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {license.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-4">
                          {new Date(license.expiryDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No licenses found</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="animate-spin" />
              </div>
            ) : auditLogs && auditLogs.length > 0 ? (
              <div className="space-y-2">
                {auditLogs.map((log: any) => (
                  <Card key={log.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{log.action}</p>
                          <p className="text-sm text-muted-foreground">
                            User {log.userId} • {new Date(log.createdAt).toLocaleString()}
                          </p>
                          {log.details && (
                            <p className="text-sm mt-1">{log.details}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-muted-foreground">No audit logs</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
