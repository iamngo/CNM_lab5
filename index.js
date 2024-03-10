const express = require("express");
const bodyParser = require("body-parser");

const { course, courses, button } = require("./data.js");

const PORT = 3000;
const app = express();

const multer = require("multer");
const AWS = require("aws-sdk");
require('dotenv').config();
const path = require('path');
const { error } = require("console");

//Cau hinh AWS
AWS.config.update({
  region: process.env.REGION,
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const tableName = 'Product';

//Cau hinh multer
const storage = multer.memoryStorage({
  destination(req, file, callback){
    callback(null,'');
  }
});
const upload = multer({
  storage,
  limits: {fieldSize: 2000000},
  fileFilter(req, file, cb){
    checkFileType(file, cb);
  }
});
function checkFileType(file, cb){
  const fileTypes = /jpeg|jpg|png|gif/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);
  if(extname && mimetype){
    return cb(null,true);
  }
  return cb('Error: Image Only Pls!');
}

app.use(express.json({ extended: false }));
app.use(express.static("./views"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set("view engine", "ejs");
app.set("views", "./views");

app.get('/', async(req, res) => {
  try{
    const params = { TableName: tableName};
    const data = await dynamodb.scan(params).promise();
    console.log(data.Items);
    return res.render('home.ejs',{products: data.Items, button: button});
    
  } catch(err) {
    console.error("Error:", err);
    return res.status(500).send('Internal Server Error');
  }
});

app.post("/save", upload.single('image'), (req, res) => {
  try {
    const id = req.body.id;
    const product_name = req.body.product_name;
    const quantity = Number(req.body.quantity);
    const image = req.file.originalname.split('-');
    const fileType = image[image.length-1];
    const filePath = `${id+Date.now().toString()}.${fileType}`;

    const paramsS3 = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: filePath,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }
    s3.upload(paramsS3, async (err, data) => {
      if(err){
        console.error("Error:", err);
        return res.send('Internal server error1!');
      } else {
        const imageURL = data.Location;
        console.log('imageURL=',imageURL);
        const paramsDynamoDb = {
          TableName: tableName,
          Item:{
            id,
            product_name,
            quantity,
            image: imageURL
          }
        };
        await dynamodb.put(paramsDynamoDb).promise();
        return res.redirect('/');
      }
    })
  } catch (error) {
    console.error('Error: ', error);
    return res.status(500).send('Internal server error!');
  }
  // console.log(req.body);
  // if(req.body.btn === "Insert"){
  //   courses.push(req.body);
  // }
  // else{
  //   let courseFound = courses.find((c) => (c.id = req.body.id));
  //   courseFound.id = req.body.id;
  //   courseFound.name = req.body.name;
  //   courseFound.quantity = req.body.quantity;
  //   courseFound.image = req.body.image;

  //   course.id = "";
  //   course.name = "";
  //   course.quantity = "";
  //   course.image = "";
  // }
  // button.value = "Insert";
  // return res.redirect("/");
});

// app.get("/update-data/:id", (req, res) => {
//   let courseFound = courses.find((c) => (c.id = req.params.id));
//   course.id = courseFound.id;
//   course.name = courseFound.name;
//   course.quantity = courseFound.quantity;
//   course.image = courseFound.image;
//   button.value = "Update";
//   return res.redirect("/");
// });

app.post("/delete", upload.fields([]), (req, res) => {
  const listCheckboxSelected = Object.keys(req.body);
  if(!listCheckboxSelected || listCheckboxSelected.length <= 0){
    return res.redirect("/");
  }
  try {
    function onDeleteItem(length){
      const params = {
        TableName: tableName,
        Key: { 'id': listCheckboxSelected[length]}
      }
      dynamodb.delete(params, (err, data) => {
        if (err) {    
          console.error("Error: ", err);
          return res.send('Internal server error!!!');
        } else {
          if(length > 0)
            onDeleteItem(length - 1);
          else
            return res.redirect('/');
        }
      })
    }
    onDeleteItem(listCheckboxSelected.length - 1);
  } catch (error) {
    console.error("Error deleting dât from dynamoDB: ", error);
    return res.status(500).send("Internal server error");
  }
  
  
    // let index = courses.map(c => c.id).indexOf(req.params.id)
    // courses.splice(index,1)
    //return res.redirect("/");
  });

app.listen(PORT, () => {
  console.log(`Server is running on the port ${PORT}`);
});
