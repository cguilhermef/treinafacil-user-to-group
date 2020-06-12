module.exports = async function(Axios, token, companyId){
    const axios = Axios.create({
        headers: {
        ...Axios.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }});
    try {
        return await axios.get(`ttps://api-treina.rz2.com.br/users?page[number]=1&page[size]=20000`)
            .then( response => response.data.data.map(u => ({id: u.id, name: u.attributes.name, email: u.attributes.email })))
            .catch(err => err);
    } catch(e) {
        return err;
    }
};
