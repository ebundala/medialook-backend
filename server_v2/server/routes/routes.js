import { Router } from 'express';
import bodyParser from 'body-parser';
import graphQlserver from '../controllers/graphql';

const router = Router();
router.use(bodyParser.json());
router.use(graphQlserver.getMiddleware());

export default router;
