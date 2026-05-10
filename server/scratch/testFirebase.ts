import 'dotenv/config';
import admin from 'firebase-admin';

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

console.log('Project ID:', firebaseProjectId);
console.log('Client Email:', firebaseClientEmail);
console.log('Private Key Start:', firebasePrivateKey?.substring(0, 30));

if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
    console.error('Environment variables are missing.');
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: firebaseProjectId,
            clientEmail: firebaseClientEmail,
            privateKey: firebasePrivateKey,
        }),
    });
    console.log('Firebase Admin SDK initialized successfully in test script.');
} catch (error) {
    console.error('Firebase Admin SDK initialization failed in test script:', error);
}
