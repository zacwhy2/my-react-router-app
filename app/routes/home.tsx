import type { Route } from "./+types/home";
import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

type Todo = {
  id: number;
  description: string;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Home Page" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase.from("todos").select("*");
      if (error) {
        console.error("Error fetching data:", error);
      } else {
        setTodos(data);
      }
    }

    fetchData();
  }, []);

  return (
    <div>
      <h1>Home Page</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>{todo.description}</li>
        ))}
      </ul>
    </div>
  );
}
