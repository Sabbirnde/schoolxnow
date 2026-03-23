import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PasswordStrengthInputProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  showStrengthIndicator?: boolean;
}

interface PasswordRequirement {
  test: (password: string) => boolean;
  text: string;
}

const passwordRequirements: PasswordRequirement[] = [
  {
    test: (password: string) => password.length >= 8,
    text: "At least 8 characters"
  },
  {
    test: (password: string) => /[a-z]/.test(password),
    text: "Contains lowercase letter"
  },
  {
    test: (password: string) => /[A-Z]/.test(password),
    text: "Contains uppercase letter"
  },
  {
    test: (password: string) => /\d/.test(password),
    text: "Contains number"
  }
];

export function PasswordStrengthInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  showStrengthIndicator = true
}: PasswordStrengthInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = (password: string): {
    score: number;
    label: string;
    color: string;
  } => {
    if (password.length === 0) {
      return { score: 0, label: "", color: "bg-gray-200" };
    }

    const passedRequirements = passwordRequirements.filter(req => req.test(password)).length;
    
    if (passedRequirements === 0) {
      return { score: 1, label: "Very Weak", color: "bg-red-500" };
    } else if (passedRequirements === 1) {
      return { score: 2, label: "Weak", color: "bg-orange-500" };
    } else if (passedRequirements === 2) {
      return { score: 3, label: "Fair", color: "bg-yellow-500" };
    } else if (passedRequirements === 3) {
      return { score: 4, label: "Good", color: "bg-blue-500" };
    } else {
      return { score: 5, label: "Strong", color: "bg-green-500" };
    }
  };

  const strength = getPasswordStrength(value);
  const isPasswordValid = passwordRequirements.every(req => req.test(value));

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={cn(
            "pr-10",
            value.length > 0 && !isPasswordValid && "border-orange-400 focus-visible:ring-orange-400"
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          disabled={disabled}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Eye className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>

      {showStrengthIndicator && value.length > 0 && (
        <div className="space-y-3">
          {/* Strength Bar */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Password Strength:</span>
              <span className={cn(
                "font-medium",
                strength.score <= 2 && "text-red-600",
                strength.score === 3 && "text-yellow-600", 
                strength.score === 4 && "text-blue-600",
                strength.score === 5 && "text-green-600"
              )}>
                {strength.label}
              </span>
            </div>
            <div className="flex space-x-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <div
                  key={level}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-colors",
                    level <= strength.score ? strength.color : "bg-gray-200"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Requirements List */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Requirements:</p>
            {passwordRequirements.map((requirement, index) => {
              const isPassed = requirement.test(value);
              return (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  {isPassed ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <X className="h-3 w-3 text-red-500" />
                  )}
                  <span className={cn(
                    isPassed ? "text-green-700" : "text-red-600"
                  )}>
                    {requirement.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  passwordRequirements.forEach(requirement => {
    if (!requirement.test(password)) {
      errors.push(requirement.text.toLowerCase());
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}
