import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <Card className="w-full max-w-md mx-4">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
        <CardDescription>
          Enter your email and password to access your inbox
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  );
}
