import express, {Express, Router} from 'express';
import MainRouting from './main';
import AuthController from "../controllers/Auth.controller";
import {AuthMiddleware} from "../middleware/Auth.middleware";
import InstanceController from "../controllers/Instance.controller";
import UserController from "../controllers/User.controller";

export default class Routing {

    app: Express;
    config: Map<String, any> = new Map<String, any>();

    constructor(app: Express) {
        this.app = app;

        this.config.set('app', this.app);

        this.init();
    }

    init(): void {
        this.app.use(express.json());
        this.app.use("/v1/", new MainRouting(this.config).getRouter);

        let router: Router = express.Router();

        this.initRoutes(router);

        this.app.use("/v1", router);
    }

    initRoutes(router: Router): void  {
        this.initAuthRoutes(router);
        this.initInstanceRoutes(router);
        this.initUserRoutes(router);
    }

    initAuthRoutes(router: Router): void {
        router.post('/auth/register', AuthController.registerUser);
        router.post('/auth/login', AuthController.userLogin);
        router.post('/auth/token/refresh', AuthController.refreshToken);
        router.post('/auth/logout', AuthController.logout);
    }

    initInstanceRoutes(router: Router): void {
        router.post('/instance', AuthMiddleware, InstanceController.createInstance);
        router.get('/instance', AuthMiddleware, InstanceController.listInstance);
        router.put('/instance/start', AuthMiddleware, InstanceController.startInstance);
        router.put('/instance/stop', AuthMiddleware, InstanceController.stopInstance);
        router.delete('/instance', AuthMiddleware, InstanceController.deleteInstance);
    }

    initUserRoutes(router: Router): void {
        router.post('/user/cookie/:cookie', AuthMiddleware, UserController.saveUserCookie);
    }

}