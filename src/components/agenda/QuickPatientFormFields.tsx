
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickPatientFormData } from '@/hooks/useQuickPatientForm';
import PatientPhotoCapture from '../pacientes/PatientPhotoCapture';
import { dataParaInputDate, calcularIdade } from '@/utils/idade';

interface QuickPatientFormFieldsProps {
  form: UseFormReturn<QuickPatientFormData>;
}

const QuickPatientFormFields = ({ form }: QuickPatientFormFieldsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
      {/* Coluna Principal - Dados Pessoais */}
      <div className="lg:col-span-2 space-y-8">
        {/* Dados Pessoais */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Nome Completo *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nome completo do paciente" 
                      className="h-11"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Email *</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="email@exemplo.com" 
                        className="h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Telefone *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(11) 99999-9999" 
                        className="h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dataNascimento"
                render={({ field }) => {
                  const idade = calcularIdade(field.value);
                  return (
                    <FormItem>
                      <FormLabel className="font-medium">Data de Nascimento</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          className="h-11"
                          value={dataParaInputDate(field.value)}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? new Date(value + 'T00:00:00') : undefined);
                          }}
                        />
                      </FormControl>
                      {idade !== undefined && (
                        <p className="text-xs text-muted-foreground mt-1">{idade} anos</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">CPF</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="000.000.000-00" 
                        className="h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">RG</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="00.000.000-0" 
                        className="h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="profissao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Profissão</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Profissão" 
                        className="h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="endereco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Endereço</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Endereço completo" 
                      className="h-11"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estadoCivil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Estado Civil</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="convenio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Convênio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="particular">Particular</SelectItem>
                        <SelectItem value="unimed">Unimed</SelectItem>
                        <SelectItem value="bradesco">Bradesco Saúde</SelectItem>
                        <SelectItem value="amil">Amil</SelectItem>
                        <SelectItem value="sulamerica">SulAmérica</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="origemLead"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Origem do Lead</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Como conheceu?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="indicacao">Indicação</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="site">Site</SelectItem>
                      <SelectItem value="panfleto">Panfleto</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Histórico Médico */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">Histórico Médico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="ultimaConsulta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Quando foi a última consulta odontológica?</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ex: 6 meses atrás, 1 ano, nunca fui, etc." 
                      className="h-11"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="historicoMedico"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Histórico Médico</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o histórico médico do paciente..."
                      className="resize-none min-h-[100px]"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="alergias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Alergias</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Liste as alergias conhecidas..."
                        className="resize-none min-h-[80px]"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="medicamentos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Medicamentos em Uso</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Liste os medicamentos que o paciente está tomando..."
                        className="resize-none min-h-[80px]"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Observações Gerais</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observações adicionais..."
                      className="resize-none min-h-[100px]"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </div>

      {/* Coluna Lateral - Foto do Paciente */}
      <div className="lg:col-span-1">
        <Card className="shadow-sm sticky top-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">Foto do Paciente</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <FormField
              control={form.control}
              name="foto"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormControl>
                    <PatientPhotoCapture
                      currentPhoto={field.value}
                      onPhotoChange={(photo) => field.onChange(photo || '')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QuickPatientFormFields;
