import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Copy, AlertCircle, Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export default function LicenseDetail() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/licenses/:id");
  const licenseId = params?.id ? parseInt(params.id) : 0;
  const utils = trpc.useUtils();

  const { data: license, isLoading } = trpc.licenses.detail.useQuery(
    { licenseId },
    { enabled: !!licenseId }
  );

  const { data: instances } = trpc.instances.list.useQuery(
    { licenseId },
    { enabled: !!licenseId && !!license }
  );

  const activeInstance = useMemo(() => (instances && instances.length > 0 ? instances[0] : null), [instances]);
  const activeInstanceId = activeInstance?.id ?? 0;

  const [botToken, setBotToken] = useState("");
  const [serverId, setServerId] = useState("");
  const [ownerId, setOwnerId] = useState(user?.discordId || "");

  const [siteConfigState, setSiteConfigState] = useState({
    ticketEnabled: false,
    whitelistEnabled: false,
    welcomeEnabled: false,
    welcomeChannelId: "",
    welcomeMessage: "",
    goodbyeEnabled: false,
    goodbyeChannelId: "",
    goodbyeMessage: "",
  });

  const { data: siteConfigData } = trpc.instances.getSiteConfig.useQuery(
    { instanceId: activeInstanceId },
    { enabled: !!activeInstanceId }
  );

  useEffect(() => {
    if (!siteConfigData) return;

    setSiteConfigState({
      ticketEnabled: !!siteConfigData.ticketEnabled,
      whitelistEnabled: !!siteConfigData.whitelistEnabled,
      welcomeEnabled: !!siteConfigData.welcomeEnabled,
      welcomeChannelId: siteConfigData.welcomeChannelId || "",
      welcomeMessage: siteConfigData.welcomeMessage || "",
      goodbyeEnabled: !!siteConfigData.goodbyeEnabled,
      goodbyeChannelId: siteConfigData.goodbyeChannelId || "",
      goodbyeMessage: siteConfigData.goodbyeMessage || "",
    });
  }, [siteConfigData]);

  const { data: instanceHealth } = trpc.instances.health.useQuery(
    { instanceId: activeInstanceId },
    { enabled: !!activeInstanceId, refetchInterval: 10000 }
  );

  const { data: instanceLogs } = trpc.instances.logs.useQuery(
    { instanceId: activeInstanceId, maxLines: 120 },
    { enabled: !!activeInstanceId, refetchInterval: 15000 }
  );

  const invalidateInstances = async () => {
    await utils.instances.list.invalidate({ licenseId });
    if (activeInstanceId) {
      await utils.instances.health.invalidate({ instanceId: activeInstanceId });
      await utils.instances.logs.invalidate({ instanceId: activeInstanceId, maxLines: 120 });
    }
  };

  const createInstanceMutation = trpc.instances.create.useMutation({
    onSuccess: async () => {
      toast.success("Instância criada e inicializada com sucesso");
      setBotToken("");
      setServerId("");
      await invalidateInstances();
    },
    onError: error => {
      toast.error(error.message || "Falha ao criar instância");
    },
  });

  const startInstanceMutation = trpc.instances.start.useMutation({
    onSuccess: async () => {
      toast.success("Instância iniciada");
      await invalidateInstances();
    },
    onError: error => toast.error(error.message || "Falha ao iniciar instância"),
  });

  const stopInstanceMutation = trpc.instances.stop.useMutation({
    onSuccess: async () => {
      toast.success("Instância parada");
      await invalidateInstances();
    },
    onError: error => toast.error(error.message || "Falha ao parar instância"),
  });

  const restartInstanceMutation = trpc.instances.restart.useMutation({
    onSuccess: async () => {
      toast.success("Instância reiniciada");
      await invalidateInstances();
    },
    onError: error => toast.error(error.message || "Falha ao reiniciar instância"),
  });

  const deleteInstanceMutation = trpc.instances.delete.useMutation({
    onSuccess: async () => {
      toast.success("Instância encerrada");
      await invalidateInstances();
    },
    onError: error => toast.error(error.message || "Falha ao excluir instância"),
  });

  const updateSiteConfigMutation = trpc.instances.updateSiteConfig.useMutation({
    onSuccess: () => toast.success("Configuração aplicada na instância"),
    onError: error => toast.error(error.message || "Falha ao salvar configuração"),
  });

  const requestTransferMutation = trpc.transfers.request.useMutation({
    onSuccess: () => toast.success("Solicitação de transferência enviada"),
    onError: error => toast.error(error.message || "Falha ao solicitar transferência"),
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

  const canCreateInstance = !activeInstance;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">{planLabelMap[license.planType] || license.planType} License</h1>
            <p className="text-muted-foreground">{license.licenseKey}</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            Back
          </Button>
        </div>

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
              <p className="text-xs text-muted-foreground">Expires {new Date(license.expiryDate).toLocaleDateString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Instance Health</CardTitle>
            </CardHeader>
            <CardContent>
              {activeInstance ? (
                <Badge variant={instanceHealth?.healthy ? "default" : "destructive"}>
                  {instanceHealth?.healthy ? "running" : "offline"}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">No instance</p>
              )}
            </CardContent>
          </Card>
        </div>

        {remainingDays <= 7 && remainingDays > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <div>
                <p className="font-semibold text-yellow-900">License Expiring Soon</p>
                <p className="text-sm text-yellow-700">Your license will expire in {remainingDays} days.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="instances" className="w-full">
          <TabsList>
            <TabsTrigger value="instances">My Instance</TabsTrigger>
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="details">License Details</TabsTrigger>
            <TabsTrigger value="transfer">Transfer</TabsTrigger>
          </TabsList>

          <TabsContent value="instances" className="space-y-4">
            {canCreateInstance ? (
              <Card>
                <CardHeader>
                  <CardTitle>Onboarding da Instância</CardTitle>
                  <CardDescription>Vincule o Discord do cliente e inicie sua instância única</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="botToken">Bot Token</Label>
                      <Input
                        id="botToken"
                        type="password"
                        placeholder="Seu token do bot Discord"
                        value={botToken}
                        onChange={e => setBotToken(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="serverId">Guild ID</Label>
                      <Input
                        id="serverId"
                        placeholder="ID do servidor Discord contratado"
                        value={serverId}
                        onChange={e => setServerId(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="ownerId">Owner Discord ID</Label>
                      <Input
                        id="ownerId"
                        placeholder="Seu Discord ID"
                        value={ownerId}
                        onChange={e => setOwnerId(e.target.value)}
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
                        Criando...
                      </>
                    ) : (
                      "Criar Instância"
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Instância Ativa</CardTitle>
                  <CardDescription>
                    Guild {activeInstance?.serverId} • Status {activeInstance?.instanceStatus}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => activeInstanceId && startInstanceMutation.mutate({ instanceId: activeInstanceId })}
                      disabled={!activeInstanceId || startInstanceMutation.isPending}
                    >
                      <Play className="w-4 h-4 mr-2" /> Start
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => activeInstanceId && stopInstanceMutation.mutate({ instanceId: activeInstanceId })}
                      disabled={!activeInstanceId || stopInstanceMutation.isPending}
                    >
                      <Square className="w-4 h-4 mr-2" /> Stop
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => activeInstanceId && restartInstanceMutation.mutate({ instanceId: activeInstanceId })}
                      disabled={!activeInstanceId || restartInstanceMutation.isPending}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" /> Restart
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (activeInstanceId && confirm("Encerrar instância atual?")) {
                          deleteInstanceMutation.mutate({ instanceId: activeInstanceId });
                        }
                      }}
                      disabled={!activeInstanceId || deleteInstanceMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <p className="text-sm font-medium">Logs (stderr)</p>
                    <pre className="p-3 text-xs bg-muted rounded-md max-h-64 overflow-auto">
                      {instanceLogs?.stderr || "Sem erros registrados"}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="configuration">
            <Card>
              <CardHeader>
                <CardTitle>Configuração Inicial pelo Site</CardTitle>
                <CardDescription>Ative módulos e mensagens sem usar comando manual no Discord</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!activeInstance ? (
                  <p className="text-sm text-muted-foreground">Crie uma instância para habilitar configuração remota.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <Label>Tickets</Label>
                      <Switch
                        checked={siteConfigState.ticketEnabled}
                        onCheckedChange={checked => setSiteConfigState(prev => ({ ...prev, ticketEnabled: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Whitelist</Label>
                      <Switch
                        checked={siteConfigState.whitelistEnabled}
                        onCheckedChange={checked =>
                          setSiteConfigState(prev => ({ ...prev, whitelistEnabled: checked }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Welcome</Label>
                        <Switch
                          checked={siteConfigState.welcomeEnabled}
                          onCheckedChange={checked =>
                            setSiteConfigState(prev => ({ ...prev, welcomeEnabled: checked }))
                          }
                        />
                      </div>
                      <Input
                        placeholder="Welcome channel ID"
                        value={siteConfigState.welcomeChannelId}
                        onChange={e => setSiteConfigState(prev => ({ ...prev, welcomeChannelId: e.target.value }))}
                      />
                      <Textarea
                        placeholder="Mensagem de boas-vindas"
                        value={siteConfigState.welcomeMessage}
                        onChange={e => setSiteConfigState(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Goodbye</Label>
                        <Switch
                          checked={siteConfigState.goodbyeEnabled}
                          onCheckedChange={checked =>
                            setSiteConfigState(prev => ({ ...prev, goodbyeEnabled: checked }))
                          }
                        />
                      </div>
                      <Input
                        placeholder="Goodbye channel ID"
                        value={siteConfigState.goodbyeChannelId}
                        onChange={e => setSiteConfigState(prev => ({ ...prev, goodbyeChannelId: e.target.value }))}
                      />
                      <Textarea
                        placeholder="Mensagem de despedida"
                        value={siteConfigState.goodbyeMessage}
                        onChange={e => setSiteConfigState(prev => ({ ...prev, goodbyeMessage: e.target.value }))}
                      />
                    </div>
                    <Button
                      onClick={() =>
                        activeInstanceId &&
                        updateSiteConfigMutation.mutate({
                          instanceId: activeInstanceId,
                          ticketEnabled: siteConfigState.ticketEnabled,
                          whitelistEnabled: siteConfigState.whitelistEnabled,
                          welcomeEnabled: siteConfigState.welcomeEnabled,
                          welcomeChannelId: siteConfigState.welcomeChannelId || null,
                          welcomeMessage: siteConfigState.welcomeMessage || null,
                          goodbyeEnabled: siteConfigState.goodbyeEnabled,
                          goodbyeChannelId: siteConfigState.goodbyeChannelId || null,
                          goodbyeMessage: siteConfigState.goodbyeMessage || null,
                        })
                      }
                      disabled={!activeInstanceId || updateSiteConfigMutation.isPending}
                    >
                      {updateSiteConfigMutation.isPending ? "Salvando..." : "Salvar configuração"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
