import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  RefreshCw,
  HelpCircle,
  Copy,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface PendingAssignmentCardProps {
  type: 'school_admin' | 'teacher';
  fullName: string;
  applicationDate: string;
  approvalStatus?: string;
  applicationId?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

/**
 * Improved UX component for pending assignment/approval screens.
 * Used when school admins or teachers are awaiting assignment or approval.
 *
 * Features:
 * - Clear status with visual indicators
 * - Application ID with copy-to-clipboard
 * - Timeline perspective
 * - Next steps and what to expect
 * - Support and FAQ sections
 * - Refresh functionality
 * - Mobile-optimized layout
 */
export function PendingAssignmentCard({
  type,
  fullName,
  applicationDate,
  approvalStatus = 'pending',
  applicationId,
  onRefresh,
  isRefreshing = false,
}: PendingAssignmentCardProps) {
  const { toast } = useToast();
  const [openFaq, setOpenFaq] = useState(false);

  const applicationDateObj = new Date(applicationDate);
  const daysWaiting = Math.floor(
    (new Date().getTime() - applicationDateObj.getTime()) / (1000 * 60 * 60 * 24)
  );
  const formattedDate = applicationDateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const copyApplicationId = () => {
    if (applicationId) {
      navigator.clipboard.writeText(applicationId);
      toast({
        title: 'Copied',
        description: 'Application ID copied to clipboard',
      });
    }
  };

  const getTypeConfig = () => {
    if (type === 'school_admin') {
      return {
        title: 'School Assignment Pending',
        icon: AlertCircle,
        badgeLabel: 'Pending Assignment',
        description:
          'Your administrator account is awaiting school assignment by the system administrator.',
        expectedWait: '1-2 business days',
        nextSteps: [
          'Wait for system administrator to assign you to a school',
          'You will be notified via email once assigned',
          'No action needed from your side',
        ],
        supportEmail: 'admin@schoolxnow.com',
        faqItems: [
          {
            q: 'What is school assignment?',
            a: 'School assignment links your administrator account to a specific school. Once assigned, you can access that school\'s dashboard and manage its operations.',
          },
          {
            q: 'How long does assignment take?',
            a: 'School assignment typically takes 1-2 business days. If it takes longer, please contact the system administrator.',
          },
          {
            q: 'Can I request a specific school?',
            a: 'The system administrator will assign you based on availability and requirements. Contact them directly to discuss preferences.',
          },
        ],
      };
    } else {
      return {
        title: 'Application Under Review',
        icon: Clock,
        badgeLabel: 'Pending Approval',
        description:
          'Your teacher application is being reviewed by the school administration. This usually takes 1-2 business days.',
        expectedWait: '1-2 business days',
        nextSteps: [
          'Your application is in the school\'s review queue',
          'You will receive an email notification once approved or if changes are needed',
          'Verify your profile information is complete and accurate',
        ],
        supportEmail: 'support@schoolxnow.com',
        faqItems: [
          {
            q: 'What is reviewed during application approval?',
            a: 'Schools verify your qualifications, documents, and profile information to ensure compliance with their hiring standards.',
          },
          {
            q: 'How long does approval usually take?',
            a: 'Most applications are reviewed within 1-2 business days. Complex cases may take longer.',
          },
          {
            q: 'What if my application is rejected?',
            a: 'You will be notified via email with a reason. You can reapply after addressing the feedback provided.',
          },
          {
            q: 'Can I contact the school directly?',
            a: 'Yes, you can reach out to the school administrator. Contact information may be available in your email notification.',
          },
        ],
      };
    }
  };

  const config = getTypeConfig();
  const IconComponent = config.icon;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Main Status Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-primary/5">
          <CardHeader className="space-y-4 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <IconComponent className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-2xl">{config.title}</CardTitle>
                  <CardDescription className="text-base mt-2">
                    {config.description}
                  </CardDescription>
                </div>
              </div>
              {onRefresh && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="self-start sm:self-auto whitespace-nowrap"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  {isRefreshing ? 'Checking...' : 'Check Status'}
                </Button>
              )}
            </div>

            {/* Status Badge */}
            <div>
              <Badge className="bg-primary/10 text-primary border border-primary/20 text-sm py-1.5 px-3">
                {config.badgeLabel}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Application Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <p className="text-base font-semibold mt-1">{fullName}</p>
              </div>

              {applicationId && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Application ID</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-background px-2 py-1 rounded border">
                      {applicationId.slice(0, 8)}...
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyApplicationId}
                      className="h-8 w-8 p-0"
                      title="Copy full ID"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">Application Date</p>
                <p className="text-base font-semibold mt-1">{formattedDate}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Time Waiting</p>
                <p className="text-base font-semibold mt-1 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {daysWaiting} {daysWaiting === 1 ? 'day' : 'days'}
                </p>
              </div>
            </div>

            {/* Timeline/What to Expect */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                What to Expect
              </h3>
              <p className="text-sm text-muted-foreground">
                Expected wait time: <span className="font-semibold text-foreground">{config.expectedWait}</span>
              </p>
              <ul className="space-y-2">
                {config.nextSteps.map((step, index) => (
                  <li key={index} className="text-sm flex gap-3 items-start">
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Support Section */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-sm">Need Help?</h3>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 text-left h-auto py-3 px-4"
                asChild
              >
                <a href={`mailto:${config.supportEmail}?subject=Application%20Status%20Inquiry`}>
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Contact Support</p>
                    <p className="text-xs text-muted-foreground">{config.supportEmail}</p>
                  </div>
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Collapsible open={openFaq} onOpenChange={setOpenFaq} className="space-y-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between text-left"
              size="lg"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Frequently Asked Questions
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${openFaq ? 'rotate-180' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-2 pt-2">
            {config.faqItems.map((faq, index) => (
              <Card key={index} className="p-4">
                <p className="font-semibold text-sm mb-2">{faq.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Additional Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
          <p className="text-blue-900 dark:text-blue-100">
            💡 <span className="font-semibold">Tip:</span> Applications that are pending for more than 3 business
            days may require follow-up. Use the contact support option to check on your status.
          </p>
        </div>
      </div>
    </div>
  );
}
