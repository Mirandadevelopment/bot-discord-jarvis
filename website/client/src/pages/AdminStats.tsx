import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, TrendingUp, Users, DollarSign, FileText } from "lucide-react";
import { useLocation } from "wouter";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminStats() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: licenses, isLoading: licensesLoading } = trpc.admin.licenses.list.useQuery();
  const { data: pendingTransfers, isLoading: transfersLoading } = trpc.admin.transfers.pending.useQuery();

  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Access denied. Admin only.</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const isLoading = licensesLoading || transfersLoading;

  // Calculate statistics
  const stats = {
    totalLicenses: licenses?.length || 0,
    activeLicenses: licenses?.filter((l: any) => l.status === 'active').length || 0,
    expiredLicenses: licenses?.filter((l: any) => l.status === 'expired').length || 0,
    suspendedLicenses: licenses?.filter((l: any) => l.status === 'suspended').length || 0,
    pendingTransfers: pendingTransfers?.length || 0,
  };

  // Plan distribution data
  const planData = [
    {
      name: 'Monthly',
      value: licenses?.filter((l: any) => l.planType === 'monthly').length || 0,
    },
    {
      name: 'Quarterly',
      value: licenses?.filter((l: any) => l.planType === 'quarterly').length || 0,
    },
    {
      name: 'Semi-Annual',
      value: licenses?.filter((l: any) => l.planType === 'semi_annual').length || 0,
    },
    {
      name: 'Annual',
      value: licenses?.filter((l: any) => l.planType === 'annual').length || 0,
    },
  ];

  // License status data
  const statusData = [
    {
      name: 'Active',
      value: stats.activeLicenses,
    },
    {
      name: 'Expired',
      value: stats.expiredLicenses,
    },
    {
      name: 'Suspended',
      value: stats.suspendedLicenses,
    },
  ];

  // Revenue estimation (rough)
  const priceMap: Record<string, number> = {
    monthly: 29.99,
    quarterly: 79.99,
    semi_annual: 149.99,
    annual: 259.99,
  };

  const estimatedRevenue = licenses?.reduce((sum: number, l: any) => {
    return sum + (priceMap[l.planType] || 0);
  }, 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Analytics & Statistics</h1>
          <p className="text-muted-foreground">System overview and performance metrics</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Total Licenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.totalLicenses}</p>
              <p className="text-xs text-muted-foreground">All licenses in system</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                Active Licenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.activeLicenses}</p>
              <p className="text-xs text-muted-foreground">
                {((stats.activeLicenses / stats.totalLicenses) * 100).toFixed(0)}% of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600" />
                Estimated Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${estimatedRevenue.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Current portfolio value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-600" />
                Pending Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stats.pendingTransfers}</p>
              <p className="text-xs text-muted-foreground">Awaiting approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Plan Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>License Distribution by Plan</CardTitle>
                <CardDescription>Breakdown of active licenses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {planData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* License Status */}
            <Card>
              <CardHeader>
                <CardTitle>License Status Overview</CardTitle>
                <CardDescription>Current status distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle>System Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Expired Licenses</p>
                <p className="text-2xl font-bold">{stats.expiredLicenses}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Suspended Licenses</p>
                <p className="text-2xl font-bold">{stats.suspendedLicenses}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Rate</p>
                <p className="text-2xl font-bold">
                  {stats.totalLicenses > 0
                    ? ((stats.activeLicenses / stats.totalLicenses) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
