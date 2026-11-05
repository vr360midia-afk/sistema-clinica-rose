import { validarCPF, validarCNPJ, validarDocumento } from '../src/utils/documentoFormat';

console.log('CPF Rosangela (032.663.962-43):', validarCPF('032.663.962-43'));
console.log('CNPJ Duracenski (69.890.045/0001-85):', validarCNPJ('69.890.045/0001-85'));
console.log('Email no CNPJ (duracenskiodontologia@gmail.com):', validarDocumento('duracenskiodontologia@gmail.com'));
console.log('CPF repetido (111.111.111-11):', validarCPF('111.111.111-11'));
console.log('CNPJ zeros (00.000.000/0000-00):', validarCNPJ('00.000.000/0000-00'));
console.log('CPF com digito errado (032.663.962-99):', validarCPF('032.663.962-99'));
console.log('CNPJ com digito errado (69.890.045/0001-99):', validarCNPJ('69.890.045/0001-99'));
