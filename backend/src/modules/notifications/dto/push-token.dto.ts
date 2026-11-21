import { IsString, Matches } from 'class-validator';
import { EXPO_PUSH_TOKEN } from '../constants/notifications.constants';

export class PushTokenDto {
  @IsString()
  @Matches(EXPO_PUSH_TOKEN, { message: 'Token de notificaciones inválido' })
  token!: string;
}
