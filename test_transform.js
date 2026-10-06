const data = {
  pacienteId: '123',
  userId: 'convidado',
  user_id: 'dono'
};

const camelToSnake = {
  userId: 'user_id',
  pacienteId: 'paciente_id'
};

const allowed = ['user_id', 'paciente_id'];

const transform = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = camelToSnake[key] || key;
    if (allowed.includes(newKey)) {
      result[newKey] = value;
    }
  }
  return result;
}

console.log(transform(data));
