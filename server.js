const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));

// Configuración de Supabase
const supabaseUrl = process.env.SUPA_URL;
const supabaseKey = process.env.SUPA_KEY;
console.log("esto es supaurl: ", supabaseUrl)
console.log("esto es supaKey: ", supabaseKey)
const supabase = createClient(supabaseUrl, supabaseKey);

// Función para cargar proveedores desde la base de datos
async function loadServiceProviders() {
  const { data, error } = await supabase
    .from('ServiceProviders')
    .select(`
      phone,
      Categories (category_name)
    `); // Aquí 'name' es el campo de la categoría que quieres obtener desde la tabla Categories
console.log("dataaaaaaaaa: ", data)
  if (error) {
    console.error('Error al cargar los proveedores de servicios:', error);
    return [];
  }

  return data.map(provider => ({
      phone: provider.phone,
      category: provider.Categories.category_name // Acceder al nombre de la categoría a través de la relación
  })); // Devolver la lista de proveedores con el nombre de la categoría
}


  // Función para insertar registros en message_logs
async function logMessage(sent_by, received_message, message_sent, sent_to, status) {
  const { data, error } = await supabase
    .from('MessageLogs')
    .insert([
      {
        sent_by: sent_by,
        received_message: received_message,
        message_sent: message_sent,
        sent_to: sent_to,
        status: status,
      }
    ]);
  
  if (error) {
    console.error('Error al guardar el registro en message_logs1:', error);
  } else {
    console.log('Registro guardado exitosamente en message_logs2:', data);
  }
}

app.post('/incoming', async (req, res) => {
  const message = req.body.Body;
  const from = req.body.From;
  console.log(req.body)
  // Verificar si el tipo de mensaje es "MessageType"
  const messageType = req.body?.MessageType;
  if (messageType !== "text") {
    console.log('Tipo de mensaje incorrecto:', messageType);
    return res.status(201).json({ message: 'Tipo de mensaje no es text' });
  }
  console.log(`Mensaje recibido de ${from}: ${message}`);

  // Cargar proveedores al recibir un mensaje
  const serviceProviders = await loadServiceProviders(); 
console.log (serviceProviders)
  // Validar coincidencias de palabra clave en la lista de proveedores
  const matchingProviders = serviceProviders.filter(provider =>
    message.toLowerCase().includes(provider.category.toLowerCase())
  );

  if (matchingProviders.length > 0) {
    // Si hay coincidencias, devolver los proveedores encontrados
    console.log('Coincidencias encontradas:', matchingProviders);

    // Aquí puedes enviar el mensaje de respuesta usando Green API
    matchingProviders.forEach(async provider => {
      const phone = 'whatsapp:+57' + provider.phone;
      
      // Quitar el la parte de whatsapp:+57
      const cleanedPhone = from.replace("whatsapp:", "");

      const messageToSend = message + ' comunicarse al número ' + cleanedPhone;
      console.log(`Se enviará el mensaje: ` + messageToSend);

      try {
        // Enviar mensaje usando Twilio
        await sendMessage(phone, messageToSend);
  
        // Registrar el mensaje exitoso en message_logs
        await logMessage(from, message, messageToSend, phone, true);
        
        // Puedes responder al mensaje si quieres
        res.send('<Response><Message>Muchas gracias por contactarnos, pronto se comunicarán con usted un experto en el servicio solicitado</Message></Response>');
  
      } catch (error) {
        console.error('Error al enviar el mensaje:', error);
  
        // Registrar en message_logs como fallo
        await logMessage(from, message, messageToSend, phone, false);
      }

    });
  } else {
    console.log('No se encontraron coincidencias para la palabra clave en el mensaje:', message);
    // Registrar el mensaje fallido en message_logs (sin coincidencias)
    await logMessage(from, message, null, null, false);
    // Puedes responder al mensaje si quieres
    res.send('<Response><Message>Muchas gracias por contactarnos, no se logró encontrar una palabra clave de lo solicitado, intente nuevamente</Message></Response>');
  
  }
  
});

// Función para enviar mensaje a través de Green API
async function sendMessage(to, message) {

  // Download the helper library from https://www.twilio.com/docs/node/install
const twilio = require("twilio"); // Or, for ESM: import twilio from "twilio";

const accountSid = process.env.TWILIOACCOUNTSID;
const authToken = process.env.TWILIOAUTH_TOKEN;
const client = twilio(accountSid, authToken);
console.log("esto es to: " + to)
const sendMessage = await client.messages.create({
  body: message,
  from: "whatsapp:+14155238886",
  to: to,
});

console.log(sendMessage.body);

  }

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
