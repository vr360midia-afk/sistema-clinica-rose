const fs = require('fs');
let c = fs.readFileSync('src/App.tsx', 'utf-8');
c = c.replace("import Pacientes from '@/pages/Pacientes';", "import Pacientes from '@/pages/Pacientes';\nimport CRM from '@/pages/CRM';");
c = c.replace('<Route path="/pacientes"', '<Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />\n              <Route path="/pacientes"');
fs.writeFileSync('src/App.tsx', c);
