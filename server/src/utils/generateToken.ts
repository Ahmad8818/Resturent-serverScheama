import jwt from 'jsonwebtoken';

interface TokenPayload {
    id: string;
}

export const generateAccessToken = (userId: string): string => {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
    if (!secret) throw new Error('JWT_SECRET is not defined');
    return jwt.sign({ id: userId } as TokenPayload, secret, { expiresIn } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: string): string => {
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    if (!secret) throw new Error('JWT_SECRET is not defined');
    return jwt.sign({ id: userId } as TokenPayload, secret, { expiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string): TokenPayload => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not defined');
    return jwt.verify(token, secret) as TokenPayload;
};
