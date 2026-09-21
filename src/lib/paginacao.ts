// O Supabase devolve no máximo 1000 linhas por consulta. Esta função busca todas as páginas em sequência
// (a consulta precisa ter uma ordenação estável, ex.: .order("id")).
export async function buscarTodos<T>(
  consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null }>
): Promise<T[]> {
  const tamanho = 1000;
  const todos: T[] = [];
  for (let de = 0; ; de += tamanho) {
    const { data } = await consulta(de, de + tamanho - 1);
    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < tamanho) break;
  }
  return todos;
}
