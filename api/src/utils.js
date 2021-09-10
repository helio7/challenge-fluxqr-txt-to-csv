const { PutObjectCommand, GetObjectCommand  } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

exports.uploadFileToS3AndGetUrl = async (client, uploadParams) => {

   // Upload file to S3.
   const command1 = new PutObjectCommand({
      Body: uploadParams.buffer,
      ContentType: uploadParams.contentType,
      Key: uploadParams.key,
      Bucket: uploadParams.bucket,
   });
   await client.send(command1);

   // Generate a 15-minutes signed URL that anyone can use to download the file.
   const command2 = new GetObjectCommand({
      Bucket: uploadParams.bucket,
      Key: uploadParams.key,
   });
   const url = await getSignedUrl(client, command2);

   // Return it.
   return url;

}