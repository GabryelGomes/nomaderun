import { DeleteAccountInfoScreen } from '@/features/auth/delete-account-info-screen';

/** Página pública de exclusão de conta (Google Play, LGPD): estática e fora dos guards de sessão (D-99). */
export default function ExcluirConta() {
  return <DeleteAccountInfoScreen />;
}
