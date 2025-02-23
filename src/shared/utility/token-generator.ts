import * as jwt from 'jsonwebtoken'; 
import * as config from 'config';

const jwtSecret: string = config.has('jwtSecret')
  ? config.get<string>('jwtSecret')
  : 'secretTest@123456';  

export const generateAuthToken = (id: string) => {
  console.log('Generating token for ID:', id);  
  console.log('Using Secret:', jwtSecret); 

  if (!jwtSecret) {
    throw new Error('JWT secret is missing!');
  }

  return jwt.sign({ id }, jwtSecret, {
    expiresIn: '30d',
  });
};

export const decodeAuthToken = (token: string) => {
  return jwt.verify(token, jwtSecret);
};
