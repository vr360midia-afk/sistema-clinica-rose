const fs = require('fs');
let c = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf-8');
c = c.replace("{ name: 'Pacientes', href: '/pacientes', icon: Users },", "{ name: 'CRM / Leads', href: '/crm', icon: Target },\n    { name: 'Pacientes', href: '/pacientes', icon: Users },");
c = c.replace('import {\r\n  Home,', 'import {\r\n  Target,\r\n  Home,');
c = c.replace('import {\n  Home,', 'import {\n  Target,\n  Home,');
fs.writeFileSync('src/components/layout/Sidebar.tsx', c);
