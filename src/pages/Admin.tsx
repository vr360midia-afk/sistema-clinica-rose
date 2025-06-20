
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Palette, Upload, Eye, Save, RotateCcw } from 'lucide-react';

const Admin = () => {
  const { toast } = useToast();
  const [tema, setTema] = useState({
    corPrimaria: '#3B82F6',
    corSecundaria: '#10B981',
    corFundo: '#F8FAFC',
    corTexto: '#1F2937',
    fontePrincipal: 'Inter',
    fonteSecundaria: 'Arial',
    logoUrl: '',
    favIcon: '',
    nomeEmpresa: 'Dental IA'
  });

  const cores = [
    { nome: 'Azul', valor: '#3B82F6' },
    { nome: 'Verde', valor: '#10B981' },
    { nome: 'Roxo', valor: '#8B5CF6' },
    { nome: 'Rosa', valor: '#EC4899' },
    { nome: 'Laranja', valor: '#F59E0B' },
    { nome: 'Vermelho', valor: '#EF4444' },
    { nome: 'Cinza', valor: '#6B7280' },
    { nome: 'Indigo', valor: '#6366F1' },
  ];

  const fontes = [
    'Inter',
    'Arial',
    'Helvetica',
    'Roboto',
    'Open Sans',
    'Montserrat',
    'Poppins',
    'Lato'
  ];

  const salvarPersonalizacao = () => {
    console.log('Salvando personalização:', tema);
    toast({
      title: "Personalização salva!",
      description: "As alterações foram aplicadas com sucesso.",
    });
  };

  const resetarTema = () => {
    setTema({
      corPrimaria: '#3B82F6',
      corSecundaria: '#10B981',
      corFundo: '#F8FAFC',
      corTexto: '#1F2937',
      fontePrincipal: 'Inter',
      fonteSecundaria: 'Arial',
      logoUrl: '',
      favIcon: '',
      nomeEmpresa: 'Dental IA'
    });
    toast({
      title: "Tema resetado",
      description: "As configurações padrão foram restauradas.",
    });
  };

  const handleFileUpload = (tipo: 'logo' | 'favicon', event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        if (tipo === 'logo') {
          setTema({...tema, logoUrl: url});
        } else {
          setTema({...tema, favIcon: url});
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Palette className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Personalização da Interface</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetarTema}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar
            </Button>
            <Button onClick={salvarPersonalizacao} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Tabs defaultValue="cores" className="space-y-6">
              <TabsList>
                <TabsTrigger value="cores">Cores</TabsTrigger>
                <TabsTrigger value="fontes">Fontes</TabsTrigger>
                <TabsTrigger value="logos">Logos</TabsTrigger>
              </TabsList>

              <TabsContent value="cores">
                <Card>
                  <CardHeader>
                    <CardTitle>Esquema de Cores</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label>Cor Primária</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="color"
                          value={tema.corPrimaria}
                          onChange={(e) => setTema({...tema, corPrimaria: e.target.value})}
                          className="w-20 h-10"
                        />
                        <Input
                          value={tema.corPrimaria}
                          onChange={(e) => setTema({...tema, corPrimaria: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {cores.map((cor) => (
                          <button
                            key={cor.nome}
                            className="w-full h-8 rounded border-2 border-gray-200 hover:border-gray-400"
                            style={{ backgroundColor: cor.valor }}
                            onClick={() => setTema({...tema, corPrimaria: cor.valor})}
                            title={cor.nome}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Cor Secundária</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="color"
                          value={tema.corSecundaria}
                          onChange={(e) => setTema({...tema, corSecundaria: e.target.value})}
                          className="w-20 h-10"
                        />
                        <Input
                          value={tema.corSecundaria}
                          onChange={(e) => setTema({...tema, corSecundaria: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        {cores.map((cor) => (
                          <button
                            key={cor.nome}
                            className="w-full h-8 rounded border-2 border-gray-200 hover:border-gray-400"
                            style={{ backgroundColor: cor.valor }}
                            onClick={() => setTema({...tema, corSecundaria: cor.valor})}
                            title={cor.nome}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Cor de Fundo</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="color"
                          value={tema.corFundo}
                          onChange={(e) => setTema({...tema, corFundo: e.target.value})}
                          className="w-20 h-10"
                        />
                        <Input
                          value={tema.corFundo}
                          onChange={(e) => setTema({...tema, corFundo: e.target.value})}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="fontes">
                <Card>
                  <CardHeader>
                    <CardTitle>Tipografia</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label>Fonte Principal</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {fontes.map((fonte) => (
                          <Button
                            key={fonte}
                            variant={tema.fontePrincipal === fonte ? 'default' : 'outline'}
                            onClick={() => setTema({...tema, fontePrincipal: fonte})}
                            style={{ fontFamily: fonte }}
                          >
                            {fonte}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label>Fonte Secundária</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {fontes.map((fonte) => (
                          <Button
                            key={fonte}
                            variant={tema.fonteSecundaria === fonte ? 'default' : 'outline'}
                            onClick={() => setTema({...tema, fonteSecundaria: fonte})}
                            style={{ fontFamily: fonte }}
                          >
                            {fonte}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logos">
                <Card>
                  <CardHeader>
                    <CardTitle>Logos e Marca</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label htmlFor="nomeEmpresa">Nome da Empresa</Label>
                      <Input
                        id="nomeEmpresa"
                        value={tema.nomeEmpresa}
                        onChange={(e) => setTema({...tema, nomeEmpresa: e.target.value})}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Logo Principal</Label>
                      <div className="mt-2 space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload('logo', e)}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer"
                        >
                          {tema.logoUrl ? (
                            <img src={tema.logoUrl} alt="Logo" className="max-h-28 max-w-full object-contain" />
                          ) : (
                            <div className="text-center">
                              <Upload className="h-8 w-8 mx-auto text-gray-400" />
                              <p className="text-sm text-gray-500 mt-2">Clique para fazer upload da logo</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>

                    <div>
                      <Label>Favicon</Label>
                      <div className="mt-2 space-y-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileUpload('favicon', e)}
                          className="hidden"
                          id="favicon-upload"
                        />
                        <label
                          htmlFor="favicon-upload"
                          className="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 cursor-pointer"
                        >
                          {tema.favIcon ? (
                            <img src={tema.favIcon} alt="Favicon" className="max-h-16 max-w-full object-contain" />
                          ) : (
                            <div className="text-center">
                              <Upload className="h-6 w-6 mx-auto text-gray-400" />
                              <p className="text-xs text-gray-500 mt-1">Upload do favicon (16x16 ou 32x32)</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div 
                    className="p-4 rounded-lg border-2"
                    style={{ 
                      backgroundColor: tema.corFundo,
                      borderColor: tema.corPrimaria 
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {tema.logoUrl && (
                        <img src={tema.logoUrl} alt="Logo" className="h-6 w-6 object-contain" />
                      )}
                      <h3 
                        className="font-bold"
                        style={{ 
                          color: tema.corTexto,
                          fontFamily: tema.fontePrincipal 
                        }}
                      >
                        {tema.nomeEmpresa}
                      </h3>
                    </div>
                    
                    <button
                      className="w-full p-2 rounded text-white font-medium mb-2"
                      style={{ backgroundColor: tema.corPrimaria }}
                    >
                      Botão Primário
                    </button>
                    
                    <button
                      className="w-full p-2 rounded text-white font-medium"
                      style={{ backgroundColor: tema.corSecundaria }}
                    >
                      Botão Secundário
                    </button>
                    
                    <p 
                      className="text-sm mt-3"
                      style={{ 
                        color: tema.corTexto,
                        fontFamily: tema.fonteSecundaria 
                      }}
                    >
                      Este é um exemplo de como ficará a interface com as suas personalizações.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;
