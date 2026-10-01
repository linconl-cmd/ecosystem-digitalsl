import { redirect } from 'next/navigation'

// Este app é só backend/painéis administrativos, sem home pública — a raiz
// manda direto pro admin, que já redireciona pro /login sozinho se não
// houver sessão (via middleware).
export default function Home() {
  redirect('/admin')
}
