const fs = require('fs');
let c = fs.readFileSync('src/components/pacientes/PatientFinancial.tsx', 'utf-8');

c = c.split('const [editingTransacao, setEditingTransacao] = useState<any | null>(null);').join('const [editingTransacao, setEditingTransacao] = useState<any | null>(null);\n  const [itemToEdit, setItemToEdit] = useState<any | null>(null);');

c = c.split("origem: 'Consulta',").join("origem: 'Consulta',\n          originalId: c.id,");
c = c.split("id: `p-${p.id}-${i}`,").join("id: `p-${p.id}-${i}`,\n          prontuarioId: p.id,\n          index: i,");

c = c.split("{r.valor > 0 && <span className=\"text-sm font-semibold shrink-0\">{brl(r.valor)}</span>}").join("<div className=\"flex items-center gap-2 shrink-0\">\n                    {r.valor > 0 && <span className=\"text-sm font-semibold\">{brl(r.valor)}</span>}\n                    <Button size=\"icon\" variant=\"ghost\" className=\"h-7 w-7\" onClick={() => setItemToEdit(r)}>\n                      <Pencil className=\"h-3.5 w-3.5\" />\n                    </Button>\n                  </div>");

c = c.split("{p.valor > 0 && <span className=\"text-sm font-semibold\">{brl(p.valor)}</span>}\n                  </div>").join("{p.valor > 0 && <span className=\"text-sm font-semibold\">{brl(p.valor)}</span>}\n                    <Button size=\"icon\" variant=\"ghost\" className=\"h-7 w-7\" onClick={() => setItemToEdit(p)}>\n                      <Pencil className=\"h-3.5 w-3.5\" />\n                    </Button>\n                  </div>");

c = c.split("export default PatientFinancial;").join("<EditProcedimentoValorModal isOpen={!!itemToEdit} onClose={() => setItemToEdit(null)} item={itemToEdit} />\n    </div>\n  );\n};\n\nexport default PatientFinancial;");
// Remove the old closing tags so we don't duplicate them
c = c.split("    </div>\n  );\n};\n\n<EditProcedimentoValorModal").join("<EditProcedimentoValorModal");

fs.writeFileSync('src/components/pacientes/PatientFinancial.tsx', c);
