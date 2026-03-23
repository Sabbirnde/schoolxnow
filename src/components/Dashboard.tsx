import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Calendar, 
  DollarSign, 
  GraduationCap, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";

export function Dashboard() {
  const stats = [
    {
      title: "Total Students",
      value: "1,247",
      change: "+12%",
      trend: "up",
      icon: Users,
      color: "text-primary"
    },
    {
      title: "Present Today",
      value: "1,156",
      change: "92.7%",
      trend: "up",
      icon: CheckCircle2,
      color: "text-success"
    },
    {
      title: "Pending Fees",
      value: "$24,580",
      change: "-8%",
      trend: "down",
      icon: DollarSign,
      color: "text-warning"
    },
    {
      title: "Active Exams",
      value: "8",
      change: "This Month",
      trend: "neutral",
      icon: GraduationCap,
      color: "text-accent"
    }
  ];

  const recentActivities = [
    { id: 1, type: "student", message: "New student John Doe registered", time: "2 hours ago", status: "success" },
    { id: 2, type: "fee", message: "Fee payment received from Alice Smith", time: "4 hours ago", status: "success" },
    { id: 3, type: "exam", message: "Math exam results published", time: "6 hours ago", status: "info" },
    { id: 4, type: "attendance", message: "Daily attendance marked for Grade 10", time: "8 hours ago", status: "info" },
    { id: 5, type: "alert", message: "Server maintenance scheduled", time: "1 day ago", status: "warning" }
  ];

  const upcomingEvents = [
    { id: 1, title: "Parent-Teacher Meeting", date: "Dec 15, 2024", type: "meeting" },
    { id: 2, title: "Science Fair", date: "Dec 20, 2024", type: "event" },
    { id: 3, title: "Winter Break Starts", date: "Dec 22, 2024", type: "holiday" },
    { id: 4, title: "Fee Due Date", date: "Dec 31, 2024", type: "deadline" }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-primary rounded-lg p-6 text-primary-foreground">
        <h1 className="text-3xl font-bold mb-2">Welcome back, Admin!</h1>
        <p className="text-primary-foreground/90">Here's what's happening at your school today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stat.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  {stat.trend === "up" && <TrendingUp className="h-3 w-3 text-success" />}
                  {stat.trend === "down" && <TrendingUp className="h-3 w-3 text-destructive rotate-180" />}
                  <p className={`text-xs ${
                    stat.trend === "up" ? "text-success" : 
                    stat.trend === "down" ? "text-destructive" : "text-muted-foreground"
                  }`}>
                    {stat.change}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === "success" ? "bg-success" :
                    activity.status === "warning" ? "bg-warning" :
                    activity.status === "info" ? "bg-primary" : "bg-muted-foreground"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              View All Activities
            </Button>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-accent" />
              Upcoming Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                  <Badge variant={
                    event.type === "deadline" ? "destructive" :
                    event.type === "meeting" ? "default" :
                    event.type === "event" ? "secondary" : "outline"
                  }>
                    {event.type}
                  </Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full mt-4">
              View Calendar
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button className="h-16 flex flex-col gap-2 bg-gradient-primary hover:opacity-90">
              <Users className="h-5 w-5" />
              <span className="text-xs">Add Student</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-2">
              <Calendar className="h-5 w-5" />
              <span className="text-xs">Mark Attendance</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-xs">Record Payment</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-2">
              <GraduationCap className="h-5 w-5" />
              <span className="text-xs">Create Exam</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
