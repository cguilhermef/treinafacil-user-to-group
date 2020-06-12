const Axios = require('axios').default;
const getUsers = require('./get-users');
const token = require('./token');
const adminToken = require('./admin-token');
const clientToken = require('./token');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const file = XLSX.readFile('users-emails.xlsx');
const page = file.Sheets[file.SheetNames[0]];
const usersNeeded = XLSX.utils.sheet_to_json(page).map(user => {
  return { name: user.Nome, email: user['E-mail'] }
});

const apiAdmin = 'https://api-treina.rz2.com.br/admin/';
const apiClient = 'https://api-treina.rz2.com.br/';

const dateStamp = function(seconds) {
  const date = new Date();
  return `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}${ seconds ? date.getSeconds().toString().padStart(2, '0') : ''}`;
};

const logError = function(message){
  try {
    fs.open(path.join('.', `errors-${ dateStamp()}.log`), 'a', function(err, fd){
      if (err) {
        console.error('Erro ao abrir arquivo de log!');
        return;
      }
      fs.write(fd, `${dateStamp(true)}: ${ message }\n`, function(err) {
        if (err){
          console.error('Erro ao escrever arquivo de log!');
          return;
        }
        fs.close(fd, function(err){
          if (err){
            console.error('Erro fechar arquivo de log!');
            return;
          }
        });
      });
    });
  } catch(err) {
    console.error('Erro ao registrar log!', err);
  }
};

const httpAdmin = Axios.create({
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }
});

const httpClient = Axios.create({
  headers: {
    'Authorization': `Bearer ${clientToken}`,
    'Content-Type': 'application/json'
  }
})

async function usersByCompanyId(companyId, page) {
  try {
    return await httpAdmin.get(`${apiAdmin}users?company_id=${companyId}&page[size]=150&page[number]=${page}`)
      .then(response => {
        return response.data;
      })
      .catch(err => console.log(err));
  } catch (err) {
    return err;
  }
};

async function assignToGroup(user, groupId, count) {
  try {
    const url = 'https://api-treina.rz2.com.br/user_groups/relationship';
    return await httpClient.post(url, { "data": { "user_id": user.id, "groups_id": groupId } })
      .then(r => {
        console.log(`${ count }) Vinculado ${user.id} - ${user.name} - ${user.email} - ${ r.data.data.id }`)
        return r.data;
      })
      .catch(err => {
        logError(`Erro ao vincular ${user.id} - ${user.name} - ${user.email} - ${err}`);
        console.log('Erro ao vincular ao grupo!');
      });
  } catch (err) {
    console.log(err);
  }
}

async function giveAccessTo(user, count) {
  try {
    const url = `${apiAdmin}users/create-access`;
    return await httpAdmin.post(url, { 'data': [{ 'user_id': user.id, 'type': 'Aluno' }] })
      .then(r => {
        console.log(`${count}\nConcedido acesso a ${user.id} - ${user.name} - ${user.email}`);
        return r.data;
      })
      .catch(err => {
        logError(`Erro ao conceder acesso a ${user.id} - ${user.name} - ${user.email} - ${err}`)
        console.log('Erro ao conceder acesso!');
      });
  } catch (err) {
    console.log(err);
  }
}

(async () => {
  const data = await usersByCompanyId(3084, 1);
  const { meta } = data;
  let usersFromAdmin = data.data;

  console.log(`Páginas: ${meta.pages}`);
  console.log('Requisitando página 1');
  console.log(`... ${usersFromAdmin.length} usuários`);

  if (meta.pages > 1) {
    for (let page = 2; page <= meta.pages; page++) {

      console.log(`Requisitando página ${page}...`);
      const { data } = await usersByCompanyId(3084, page);
      console.log(`... ${data.length} usuários`);

      usersFromAdmin = usersFromAdmin.concat(data);
    }
  }

  const usersWithoutAccessToTreina = usersFromAdmin.filter(user => !user.treinafacil_access);

  let usersNotRegistered = [];
  for(let i = 0; i < usersNeeded.length; i++) {
    const userFromAdmin = usersFromAdmin.find(u => u.email.toLowerCase() === usersNeeded[i].email.toLowerCase());
    if (!userFromAdmin){
      usersToAssign.push(userFromAdmin);
    }
  }

  let usersToGiveAccess = [];
  for(let i = 0; i < usersNeeded.length; i++) {
    const userFromAdmin = usersWithoutAccessToTreina.find(u => u.email.toLowerCase() === usersNeeded[i].email.toLowerCase());
    if (userFromAdmin){
      usersToAssign.push(userFromAdmin);
    }
  }

  let usersToAssign = [];
  for(let i = 0; i < usersNeeded.length; i++) {
    const userFromAdmin = usersFromAdmin.find(u => u.email.toLowerCase() === usersNeeded[i].email.toLowerCase());
    if (userFromAdmin) {
      usersToAssign.push(userFromAdmin);
    }
  }

  console.log(`
    Usuários no admin: ${ usersFromAdmin.length}
    Usuários sem acesso: ${ usersWithoutAccessToTreina.length}
    Usuários da lista: ${ usersNeeded.length}
    Usuários que precisam acesso: ${ usersToGiveAccess.length}
    Usuários não cadastrados: ${ usersNotRegistered.length}
  `);

  const countToGiveAccess = usersToGiveAccess.length;
  for (let i = 0; i < countToGiveAccess; i++) {
    const user = usersToGiveAccess[i];
    await giveAccessTo(user, i);
  }
  const countToAssign = usersToAssign.length;
  for (let i = 0; i < countToAssign; i++) {
    const user = usersToAssign[i];
    await assignToGroup(user, 821, i);
  }

  if (!usersNotRegistered.length > 0) {
    fs.writeFileSync(path.join('.', `users-not-registered-${ dateStamp()}.json`), JSON.stringify(usersNotRegistered));
  }

  fs.closeSync(errorsLog);

})();