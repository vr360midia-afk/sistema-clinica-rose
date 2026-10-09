const fs = require('fs');
let c = fs.readFileSync('src/components/pacientes/PatientTimeline.tsx', 'utf-8');
c = c.replace('  return (\n    <div className="relative pl-5 sm:pl-6">', '  return (\n    <>\n    <div className="relative pl-5 sm:pl-6">');
c = c.replace('  return (\r\n    <div className="relative pl-5 sm:pl-6">', '  return (\r\n    <>\r\n    <div className="relative pl-5 sm:pl-6">');
fs.writeFileSync('src/components/pacientes/PatientTimeline.tsx', c);
