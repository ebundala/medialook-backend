import { Router } from 'express';
import bodyParser from 'body-parser';
import graphQlserver from '../controllers/graphql';
// import {
// loginHandler, signUpHandler, createSession, revokeSession, linkIDProvider,
// } from '../controllers/auth';
// import tokenAuth from '../middlewares/tokenAuth';

const router = Router();
router.use(bodyParser.json());
// TODO: create openApi spec for rest api
// router.post('/auth/login', loginHandler);
// router.post('/auth/signup', signUpHandler);
// takes an idtoken from idp in authorization header and link with  user
// router.post('/auth/link', linkIDProvider);
// takes an idToken in authorization header and create a session token
// router.post('/auth/session', createSession);
// graphQlserver server
// Todo move it below auth in prod
// graphQlserver.applyMiddleware({ app: router });
router.use(graphQlserver.getMiddleware());
// router.use(tokenAuth);
// router.get('/auth/revokeSession', revokeSession);
export default router;
