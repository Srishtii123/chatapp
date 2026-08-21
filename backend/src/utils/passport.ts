import passport from "passport";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";

passport.use(new JwtStrategy({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: process.env.APP_SECRET || "BAYANAT" }, (payload, done) => {
  if (!payload?.loginid) return done(null, false);
  done(null, payload);
}));
