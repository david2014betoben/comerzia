import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmailForAuth(email);

    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordValido = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValido) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const { passwordHash: _password, ...usuarioSeguro } = user;
    return usuarioSeguro;
  }

  async login(user: { id: number; email: string; rol: string }) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      rol: user.rol,
    });

    return {
      access_token: accessToken,
      usuario: user,
    };
  }
}
