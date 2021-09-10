const { uploadFileToS3AndGetUrl } = require('./src/utils');
const { S3Client } = require('@aws-sdk/client-s3');
const fileUpload = require('express-fileupload');
const ObjectsToCsv = require('objects-to-csv');
const express = require('express');
const papa = require('papaparse');
const fs = require('fs');
const app = express();

require('dotenv').config();

// Client used to upload files to S3.
const client = new S3Client({ 
   region: process.env.AWS_S3_REGION,
   credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
   }
});

const clientPort = process.env.CLIENT_PORT;

// 'express-fileupload' makes the uploaded files available under req.files
// for 'multipart/form-data' requests.
app.use(fileUpload({
   createParentPath: true
}));

app.use((req, res, next) => {
   res.set({
      'Access-Control-Allow-Origin': `http://localhost:${clientPort}`,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST'
   });
   next();
});

app.post('/convert-file', async (req, res) => {

   // Get file.
   const file = req.files.file;

   // The file to convert must be .txt or .csv
   if (file.mimetype !== 'text/plain' && file.mimetype !== 'application/vnd.ms-excel') {
      res.status(400);
      res.send('Unsupported file type.');
      return;
   }

   // File name must match 'FLUX_DDMMYYYY.ext' format.
   if (file.name.length !== 17 || file.name.substring(0, 5) !== 'FLUX_') {
      res.status(400);
      res.send("File name doesn't match 'FLUX_DDMMYYYY.ext' format.");
      return;
   }

   // Parse file content to a string in memory.
   let fileData = file.data.toString();

   // Remove '\r' and '\n' characters and separate the string in rows.
   const fileRows = []; // Each element will be a file row.
   let currentRow = ''; // Temporal auxiliar variable where we keep track of a row we will eventually save.
   for (const character of fileData) {
      switch (character) {

         // We'll use the '\n' escape line character as rows separator.
         case '\n':
            fileRows.push(currentRow); // Add a new row to the list.
            currentRow = ''; // Reset auxiliar variable.
            break;

         case '\r':
            // Ignore this character.
            break;

         default:
            // Add character to the current row.
            currentRow += character;
            break;

      }
   }
   if (currentRow) {
      // If there is pending characters, push them in a last line.
      fileRows.push(currentRow);
   }

   let buffer;
   let contentType;
   let key;

   // .txt file case.
   if (file.mimetype === 'text/plain') {

      // We have to generate a .csv file that shows the registry rows data.

      // Use the the REGISTRY rows in the file rows array to generate data objects.
      const csvDataObjects = []; // Here we'll save those objects.
      for (const row of fileRows) {
         // Only select the registry rows.
         if (row[0] === 'R') {

            // Transaction type.
            let type;
            let typeString = row.substring(1, 3);
            switch (typeString) {
               case 'PA':
                  type = 'payment';
                  break;
               case 'RV':
                  type = 'reversal';
                  break;
               case 'RE':
                  type = 'refund';
               default:
                  break;
            }

            // Amount in cents.
            let amount;
            let amountString = row.substring(3, 15);
            amount = parseInt(amountString).toString(); // Remove preceding zeros.
            if (amount.length >= 3) {
               // Add a period in the correct position to represent a decimal.
               amount = [
                  amount.slice(0, amount.length - 2),
                  '.',
                  amount.slice(amount.length - 2),
               ].join('');
            }

            // Date in DDMMYYYY format.
            let date;
            let dateString = row.substring(15, 23);
            date = [
               dateString.slice(0, dateString.length - 4),
               '/',
               dateString.slice(dateString.length - 4),
            ].join(''); // Add a '/' in the correct position to properly format the date.
            date = [
               date.slice(0, 2),
               '/',
               date.slice(2),
            ].join(''); // Add a '/' in the correct position to properly format the date.

            // Time in HHMMSS format.
            let time;
            let timeString = row.substring(23, 29);
            time = [
               timeString.slice(0, timeString.length - 2),
               ':',
               timeString.slice(timeString.length - 2),
            ].join(''); // Add a ':' in the correct position to properly format the time.
            time = [
               time.slice(0, 2),
               ':',
               time.slice(2),
            ].join(''); // Add a ':' in the correct position to properly format the time.

            // External ID.
            let externalId;
            let externalIdString = row.substring(29, 65);
            externalId = parseInt(externalIdString); // Remove preceding zeros.
            
            // Cashback.
            let cashback;
            let cashbackString = row.substring(87, 97);
            cashback = parseInt(cashbackString).toString(); // Remove preceding zeros.
            if (cashback.length >= 3) {
               // Add a period in the correct position to represent a decimal.
               cashback = [
                  cashback.slice(0, cashback.length - 2),
                  '.',
                  cashback.slice(cashback.length - 2),
               ].join('');
            }

            // Cashback.
            let cashout;
            let cashoutString = row.substring(97, 109);
            cashout = parseInt(cashoutString).toString(); // Remove preceding zeros.
            if (cashout.length >= 3) {
               // Add a period in the correct position to represent a decimal.
               cashout = [
                  cashout.slice(0, cashout.length - 2),
                  '.',
                  cashout.slice(cashout.length - 2),
               ].join('');
            }

            csvDataObjects.push({
               type,
               amount,
               date,
               time,
               externalId,
               authorization: row.substring(65, 77),
               store: row.substring(77, 83),
               terminal: row.substring(83, 87),
               cashback,
               cashout,
            });

         }
      }

      // Create .csv file on the disk.
      const csvDataToWrite = new ObjectsToCsv(csvDataObjects);
      await csvDataToWrite.toDisk('./temp.csv');

      // Read the file from the disk to get a Buffer object.
      const csvFileBuffer = await fs.readFileSync('./temp.csv');

      buffer = csvFileBuffer;
      contentType = 'text/csv';
      key = `${file.name.substring(0, 13)}.csv`; // Use same name as the .csv file.

   }
   
   // .csv file case.
   else if (file.mimetype === 'application/vnd.ms-excel') {

      // We have to generate a .txt file that has in its registry rows the .csv data.

      // Start creating the rows that will be inserted in the new .txt file.
      const txtData = []; // Here we'll save those rows.

      // Create the header, using the file's name.
      const header = `H${file.name.substring(5, 13)}`;
      txtData.push(header);

      // Pass the serialized .csv file data to a library that returns the column values of each row.
      const result = papa.parse(fileData);

      // Go over every .csv row.
      for (let i = 0; i<result.data.length; i++) {

         // The first row just describes the columns' names.
         // Papaparse can interpret empty lines as data rows. We have to ignore those too.
         if (i !== 0 && result.data[i].length === 10) {

            // Parse the values and generate an string ('registryText') prepared for the final .txt file.

            // Flag that indicates new line.
            let registryText = 'R';

            // Transaction type.
            let type;
            switch (result.data[i][0]) {
               case 'payment':
                  type = 'PA';
                  break;
               case 'reversal':
                  type = 'RV';
                  break;
               case 'refund':
                  type = 'RE';
                  break;
               default:
                  break;
            }
            registryText = registryText.concat(type);

            // Amount in cents.
            const centsString = result.data[i][1].replace(/\./g, '');
            const zeroesToAdd1 = 12 - centsString.length;
            registryText = registryText.concat(
               ('0'.repeat(zeroesToAdd1)) + centsString
            );
            
            // Date in DDMMYYYY format.
            const dateString = result.data[i][2].replace(/\//g, ''); 
            registryText = registryText.concat(dateString);

            // Time in HHMMSS format.
            const timeString = result.data[i][3].replace(/:/g, ''); 
            registryText = registryText.concat(timeString);

            // External ID.
            const externalIdString = result.data[i][4];
            const zeroesToAdd2 = 36 - externalIdString.length;
            registryText = registryText.concat(
               ('0'.repeat(zeroesToAdd2)) + externalIdString
            );

            // Authorization number.
            const authorizationIdString = result.data[i][5];
            registryText = registryText.concat(authorizationIdString);

            // Store ID.
            const storeIdString = result.data[i][6];
            registryText = registryText.concat(storeIdString);

            // Terminal ID.
            const terminalIdString = result.data[i][7];
            registryText = registryText.concat(terminalIdString);

            // Cashback amount.
            const cashbackAmountString = result.data[i][8].replace(/\./g, '');
            const zeroesToAdd3 = 10 - cashbackAmountString.length;
            registryText = registryText.concat(
               ('0'.repeat(zeroesToAdd3)) + cashbackAmountString
            );

            // Cashout amount.
            const cashoutAmountString = result.data[i][9].replace(/\./g, '');
            const zeroesToAdd4 = 12 - cashoutAmountString.length;
            registryText = registryText.concat(
               ('0'.repeat(zeroesToAdd4)) + cashoutAmountString
            );

            // Insert registry.
            txtData.push(registryText);

         }
         
      }

      // Create the footer.
      const transactionsNumber = txtData.length - 1;
      const transactionsNumberString = transactionsNumber.toString();
      const zeroesToAdd5 = 6 - transactionsNumberString.length;
      let footer = `F${'0'.repeat(zeroesToAdd5)}${transactionsNumberString}`;
      // Calculate total balance.
      let totalBalance = 0;
      let i = 0;
      for (const row of txtData) {
         // Ignore header
         if (i) {
            const type = row.substring(1, 3);
            const amount = parseInt(row.substring(3, 15));
            switch (type) {
               case 'PA':
                  totalBalance += amount;
                  break;
               case 'RV':
               case 'RE':
                  totalBalance -= amount;
                  break;
               default:
                  break;
            }
         }
         i++;
      }
      // Calculate total balance for footer.
      const totalBalanceString = totalBalance.toString();
      const zeroesToAdd6 = 15 - totalBalanceString.length;
      footer = footer.concat(
         ('0'.repeat(zeroesToAdd6)) + totalBalanceString
      );
      // Add footer.
      txtData.push(footer);

      // Join the rows.
      let txtString = '';
      for (const row of txtData) {
         txtString = txtString.concat(row);
         if (row[0] !== 'F') txtString = txtString.concat('\r\n');
      }

      // Create a buffer.
      const txtFileBuffer = Buffer.from(txtString);

      buffer = txtFileBuffer;
      contentType = 'text/plain';
      key = `${file.name.substring(0, 13)}.txt`; // Use same name as the .csv file.

   }

   // Use the Buffer to upload the file to S3 and get a download link.
   const downloadLink = await uploadFileToS3AndGetUrl(client, {
      buffer,
      contentType,
      key,
      bucket: process.env.AWS_S3_BUCKET,
   });

   // Return the download link.
   res.json({
      download_link: downloadLink,
   });

});

app.get('/', (req, res) => {
   res.send("This is Dylan's FluxQR TXT-CSV API. 2021/09/10.")
});

const serverPort = process.env.SERVER_PORT;
app.listen(serverPort, () => {
   console.log(`E-commerce backend listening at http://localhost:${serverPort}`);
});
