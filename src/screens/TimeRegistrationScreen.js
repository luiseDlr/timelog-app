import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Switch,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  fetchProjects,
  fetchTasks,
  createTimeRegistration,
  fetchTodayEntries,
  fetchTimesheetStatus,
  submitTimesheet,
  fetchAbsenceCodes,
  createAbsenceRegistration,
} from '../services/timelogApi';
import Banner from '../components/Banner';

function toISODate(date) {
  return date.toISOString().split('T')[0];
}

function formatHours(h) {
  if (!h && h !== 0) return '—';
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const APPROVAL_LABELS = { 0: 'Open', 1: 'Submitted', 2: 'Approved', 3: 'Rejected' };
const APPROVAL_COLORS = { 0: '#10b981', 1: '#f59e0b', 2: '#2563eb', 3: '#ef4444' };
const STEP_ORDER = ['customer', 'project', 'task', 'details'];
const STEP_LABELS = ['Customer', 'Project', 'Task', 'Details'];

export default function TimeRegistrationScreen({ pat, siteName, customers, onDisconnect }) {
  // Step wizard state
  const [step, setStep] = useState('customer');

  // Confirmed selections (locked in when "Continue" is pressed)
  const [customer, setCustomer] = useState(null);
  const [project, setProject] = useState(null);
  const [task, setTask] = useState(null);

  // In-progress picker selections (before confirming)
  const [pickedCustomer, setPickedCustomer] = useState(customers[0] || null);
  const [pickedProject, setPickedProject] = useState(null);
  const [pickedTask, setPickedTask] = useState(null);

  // Lists loaded per step
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);

  // Time entry form
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hours, setHours] = useState('');
  const [comment, setComment] = useState('');
  const [billable, setBillable] = useState(true);

  // Absence mode
  const [absenceMode, setAbsenceMode] = useState(false);
  const [absenceCodes, setAbsenceCodes] = useState([]);
  const [absenceCode, setAbsenceCode] = useState(null);

  // Loading / feedback
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState({ message: '', type: 'success' });

  // Today's entries
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Timesheet status
  const [timesheetStatus, setTimesheetStatus] = useState(null);
  const [submittingSheet, setSubmittingSheet] = useState(false);

  const todayStr = toISODate(date);
  const stepIndex = STEP_ORDER.indexOf(step);

  const showBanner = (message, type = 'success') => setBanner({ message, type });

  // Load today's entries + timesheet status
  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const [items, statuses] = await Promise.all([
        fetchTodayEntries(pat, siteName, todayStr),
        fetchTimesheetStatus(pat, siteName, [todayStr]),
      ]);
      setEntries(items || []);
      if (statuses && statuses.length > 0) setTimesheetStatus(statuses[0]);
    } catch (e) {
      // Non-critical
    } finally {
      setLoadingEntries(false);
    }
  }, [pat, siteName, todayStr]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Fetch projects whenever we enter the project step
  useEffect(() => {
    if (step !== 'project' || !customer) return;
    setLoadingProjects(true);
    setProjects([]);
    setPickedProject(null);
    fetchProjects(pat, siteName, customer.CustomerID)
      .then((data) => {
        setProjects(data || []);
        if (data && data.length > 0) setPickedProject(data[0]);
      })
      .catch((e) => showBanner(e.message || 'Failed to load projects', 'error'))
      .finally(() => setLoadingProjects(false));
  }, [step, customer]);

  // Fetch tasks whenever we enter the task step
  useEffect(() => {
    if (step !== 'task' || !project) return;
    setLoadingTasks(true);
    setTasks([]);
    setPickedTask(null);
    fetchTasks(pat, siteName, project.ProjectID)
      .then((data) => {
        setTasks(data || []);
        if (data && data.length > 0) setPickedTask(data[0]);
      })
      .catch((e) => showBanner(e.message || 'Failed to load tasks', 'error'))
      .finally(() => setLoadingTasks(false));
  }, [step, project]);

  // Load absence codes when switching to absence mode
  useEffect(() => {
    if (!absenceMode || absenceCodes.length > 0) return;
    fetchAbsenceCodes(pat, siteName)
      .then((codes) => {
        setAbsenceCodes(codes || []);
        if (codes && codes.length > 0) setAbsenceCode(codes[0]);
      })
      .catch(() => {});
  }, [absenceMode]);

  // ── Step navigation ──────────────────────────────────────────────────────────

  function confirmCustomer() {
    if (!pickedCustomer) return showBanner('Please select a customer.', 'error');
    setCustomer(pickedCustomer);
    setProject(null);
    setTask(null);
    setStep('project');
  }

  function confirmProject() {
    if (!pickedProject) return showBanner('Please select a project.', 'error');
    setProject(pickedProject);
    setTask(null);
    setStep('task');
  }

  function confirmTask() {
    if (!pickedTask) return showBanner('Please select a task.', 'error');
    setTask(pickedTask);
    setBillable(pickedTask.IsDefaultBillable ?? true);
    setStep('details');
  }

  // ── Submission ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (absenceMode) { await handleAbsenceSubmit(); return; }

    if (!task) return showBanner('Please select a task.', 'error');
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 24) return showBanner('Hours must be between 0 and 24.', 'error');
    if (task.AdditionalTextIsRequired && !comment.trim()) {
      return showBanner('A comment is required for this task.', 'error');
    }

    setSubmitting(true);
    try {
      await createTimeRegistration(pat, siteName, {
        TaskID: task.TaskID,
        Date: todayStr,
        Hours: h,
        Comment: comment.trim() || undefined,
        Billable: billable,
        BillableHours: billable ? h : 0,
      });
      showBanner('Time entry registered successfully!', 'success');
      setHours('');
      setComment('');
      await loadEntries();
    } catch (e) {
      showBanner(e.message === 'AUTH_FAILED' ? 'Authentication failed. Check your token.' : (e.message || 'Failed to register time.'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAbsenceSubmit() {
    if (!absenceCode) return showBanner('Please select an absence code.', 'error');
    const h = parseFloat(hours);
    if (isNaN(h) || h <= 0 || h > 24) return showBanner('Hours must be between 0 and 24.', 'error');

    setSubmitting(true);
    try {
      await createAbsenceRegistration(pat, siteName, {
        AbsenceID: absenceCode.AbsenceID || absenceCode.ID,
        Date: todayStr,
        Hours: h,
        Comment: comment.trim() || undefined,
      });
      showBanner('Absence registered successfully!', 'success');
      setHours('');
      setComment('');
      await loadEntries();
    } catch (e) {
      showBanner(e.message || 'Failed to register absence.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitTimesheet() {
    if (!timesheetStatus || timesheetStatus.ApprovalStatus === 1 || timesheetStatus.ApprovalStatus === 2) return;
    setSubmittingSheet(true);
    try {
      await submitTimesheet(pat, siteName, [todayStr]);
      showBanner('Timesheet submitted for approval.', 'success');
      await loadEntries();
    } catch (e) {
      showBanner(e.message || 'Failed to submit timesheet.', 'error');
    } finally {
      setSubmittingSheet(false);
    }
  }

  const canSubmitSheet =
    timesheetStatus &&
    (timesheetStatus.ApprovalStatus === 0 || timesheetStatus.ApprovalStatus === 3) &&
    entries.length > 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loadingEntries} onRefresh={loadEntries} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>TimeLog</Text>
        </View>
        <TouchableOpacity onPress={onDisconnect} style={styles.disconnectBtn}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </View>

      <Banner message={banner.message} type={banner.type} onDismiss={() => setBanner({ message: '', type: 'success' })} />

      {/* Mode toggle */}
      <View style={styles.modeRow}>
        <TouchableOpacity style={[styles.modeTab, !absenceMode && styles.modeTabActive]} onPress={() => setAbsenceMode(false)}>
          <Text style={[styles.modeTabText, !absenceMode && styles.modeTabTextActive]}>Task Time</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeTab, absenceMode && styles.modeTabActive]} onPress={() => setAbsenceMode(true)}>
          <Text style={[styles.modeTabText, absenceMode && styles.modeTabTextActive]}>Absence</Text>
        </TouchableOpacity>
      </View>

      {/* ── Task Time: step wizard ── */}
      {!absenceMode && (
        <>
          {/* Step indicator */}
          <View style={styles.stepRow}>
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={label}>
                <View style={styles.stepItem}>
                  <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive, i < stepIndex && styles.stepDotDone]}>
                    {i < stepIndex
                      ? <Text style={styles.stepDoneIcon}>✓</Text>
                      : <Text style={[styles.stepNum, i <= stepIndex && styles.stepNumActive]}>{i + 1}</Text>
                    }
                  </View>
                  <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>{label}</Text>
                </View>
                {i < STEP_LABELS.length - 1 && (
                  <View style={[styles.stepConnector, i < stepIndex && styles.stepConnectorActive]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* Breadcrumb of confirmed selections */}
          {(customer || project || task) && (
            <View style={styles.breadcrumb}>
              {customer && (
                <TouchableOpacity style={styles.crumb} onPress={() => setStep('customer')}>
                  <Text style={styles.crumbText} numberOfLines={1}>{customer.Name}</Text>
                  <Text style={styles.crumbEdit}> ✎</Text>
                </TouchableOpacity>
              )}
              {project && (
                <>
                  <Text style={styles.crumbSep}>›</Text>
                  <TouchableOpacity style={styles.crumb} onPress={() => setStep('project')}>
                    <Text style={styles.crumbText} numberOfLines={1}>{project.Name}</Text>
                    <Text style={styles.crumbEdit}> ✎</Text>
                  </TouchableOpacity>
                </>
              )}
              {task && (
                <>
                  <Text style={styles.crumbSep}>›</Text>
                  <TouchableOpacity style={styles.crumb} onPress={() => setStep('task')}>
                    <Text style={styles.crumbText} numberOfLines={1}>{task.Name}</Text>
                    <Text style={styles.crumbEdit}> ✎</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {/* Step card */}
          <View style={styles.card}>

            {/* STEP 1: Customer */}
            {step === 'customer' && (
              <>
                <Text style={styles.cardTitle}>Select Customer</Text>
                <Text style={styles.label}>Customer</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={pickedCustomer?.CustomerID}
                    onValueChange={(val) => {
                      const c = customers.find((x) => x.CustomerID === Number(val));
                      if (c) setPickedCustomer(c);
                    }}
                    style={styles.picker}
                  >
                    {customers.length === 0 && <Picker.Item label="No customers available" value={null} />}
                    {customers.map((c) => (
                      <Picker.Item key={c.CustomerID} label={c.Name} value={c.CustomerID} />
                    ))}
                  </Picker>
                </View>
                <TouchableOpacity
                  style={[styles.nextButton, !pickedCustomer && styles.buttonDisabled]}
                  onPress={confirmCustomer}
                  disabled={!pickedCustomer}
                >
                  <Text style={styles.nextButtonText}>Continue to Projects →</Text>
                </TouchableOpacity>
              </>
            )}

            {/* STEP 2: Project */}
            {step === 'project' && (
              <>
                <Text style={styles.cardTitle}>Select Project</Text>
                {loadingProjects ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.loadingText}>Loading projects…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>Project</Text>
                    <View style={[styles.pickerWrapper, projects.length === 0 && styles.disabled]}>
                      <Picker
                        selectedValue={pickedProject?.ProjectID}
                        onValueChange={(val) => {
                          const p = projects.find((x) => x.ProjectID === Number(val));
                          if (p) setPickedProject(p);
                        }}
                        enabled={projects.length > 0}
                        style={styles.picker}
                      >
                        <Picker.Item label={projects.length === 0 ? 'No projects available' : 'Select project...'} value={null} />
                        {projects.map((p) => (
                          <Picker.Item key={p.ProjectID} label={p.Name} value={p.ProjectID} />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.backButton} onPress={() => setStep('customer')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.nextButton, styles.nextButtonFlex, (!pickedProject || loadingProjects) && styles.buttonDisabled]}
                    onPress={confirmProject}
                    disabled={!pickedProject || loadingProjects}
                  >
                    <Text style={styles.nextButtonText}>Continue to Tasks →</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* STEP 3: Task */}
            {step === 'task' && (
              <>
                <Text style={styles.cardTitle}>Select Task</Text>
                {loadingTasks ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.loadingText}>Loading tasks…</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>Task</Text>
                    <View style={[styles.pickerWrapper, tasks.length === 0 && styles.disabled]}>
                      <Picker
                        selectedValue={pickedTask?.TaskID}
                        onValueChange={(val) => {
                          const t = tasks.find((x) => x.TaskID === Number(val));
                          if (t) setPickedTask(t);
                        }}
                        enabled={tasks.length > 0}
                        style={styles.picker}
                      >
                        <Picker.Item label={tasks.length === 0 ? 'No tasks available' : 'Select task...'} value={null} />
                        {tasks.map((t) => (
                          <Picker.Item key={t.TaskID} label={t.Name} value={t.TaskID} />
                        ))}
                      </Picker>
                    </View>
                  </>
                )}
                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.backButton} onPress={() => setStep('project')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.nextButton, styles.nextButtonFlex, (!pickedTask || loadingTasks) && styles.buttonDisabled]}
                    onPress={confirmTask}
                    disabled={!pickedTask || loadingTasks}
                  >
                    <Text style={styles.nextButtonText}>Continue to Details →</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* STEP 4: Details */}
            {step === 'details' && (
              <>
                <Text style={styles.cardTitle}>Register Time</Text>

                {/* Billable toggle */}
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Billable</Text>
                  <Switch value={billable} onValueChange={setBillable} trackColor={{ true: '#2563eb' }} />
                </View>

                {/* Date */}
                <Text style={styles.label}>Date</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateText}>{todayStr}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(_, selected) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selected) setDate(selected);
                    }}
                    maximumDate={new Date()}
                  />
                )}

                {/* Hours */}
                <Text style={styles.label}>Hours</Text>
                <TextInput
                  style={styles.input}
                  value={hours}
                  onChangeText={setHours}
                  placeholder="e.g. 2.5"
                  keyboardType="decimal-pad"
                />

                {/* Comment */}
                <Text style={styles.label}>
                  Comment{task?.AdditionalTextIsRequired ? ' *' : ' (optional)'}
                </Text>
                <TextInput
                  style={[styles.input, styles.commentInput]}
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Add a comment..."
                  multiline
                  numberOfLines={3}
                />

                <View style={styles.buttonRow}>
                  <TouchableOpacity style={styles.backButton} onPress={() => setStep('task')}>
                    <Text style={styles.backButtonText}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitButton, styles.submitButtonFlex, submitting && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                  >
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Time Entry</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </>
      )}

      {/* ── Absence mode ── */}
      {absenceMode && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Register Absence</Text>

          <Text style={styles.label}>Absence Code</Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={absenceCode?.AbsenceID || absenceCode?.ID}
              onValueChange={(val) => {
                const c = absenceCodes.find((x) => (x.AbsenceID || x.ID) === val);
                if (c) setAbsenceCode(c);
              }}
              style={styles.picker}
            >
              {absenceCodes.length === 0 && <Picker.Item label="Loading..." value={null} />}
              {absenceCodes.map((c) => (
                <Picker.Item key={c.AbsenceID || c.ID} label={c.Name} value={c.AbsenceID || c.ID} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateText}>{todayStr}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setDate(selected);
              }}
              maximumDate={new Date()}
            />
          )}

          <Text style={styles.label}>Hours</Text>
          <TextInput
            style={styles.input}
            value={hours}
            onChangeText={setHours}
            placeholder="e.g. 2.5"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Comment (optional)</Text>
          <TextInput
            style={[styles.input, styles.commentInput]}
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment..."
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit Absence</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* Timesheet status */}
      {timesheetStatus && (
        <View style={styles.card}>
          <View style={styles.sheetRow}>
            <Text style={styles.cardTitle}>Timesheet Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: APPROVAL_COLORS[timesheetStatus.ApprovalStatus] + '22' }]}>
              <Text style={[styles.statusText, { color: APPROVAL_COLORS[timesheetStatus.ApprovalStatus] }]}>
                {APPROVAL_LABELS[timesheetStatus.ApprovalStatus] || 'Unknown'}
              </Text>
            </View>
          </View>
          <Text style={styles.sheetHours}>Total hours today: {formatHours(timesheetStatus.Hours)}</Text>
          {canSubmitSheet && (
            <TouchableOpacity
              style={[styles.sheetButton, submittingSheet && styles.buttonDisabled]}
              onPress={handleSubmitTimesheet}
              disabled={submittingSheet}
            >
              {submittingSheet ? <ActivityIndicator color="#2563eb" /> : <Text style={styles.sheetButtonText}>Submit for Approval</Text>}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Today's entries */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          Entries for {todayStr} {loadingEntries && <ActivityIndicator size="small" color="#2563eb" />}
        </Text>
        {entries.length === 0 && !loadingEntries ? (
          <Text style={styles.emptyText}>No entries logged yet.</Text>
        ) : (
          entries.map((entry, i) => (
            <View key={i} style={styles.entryRow}>
              <View style={styles.entryLeft}>
                <Text style={styles.entryHours}>{formatHours(entry.Hours)}</Text>
                <View>
                  <Text style={styles.entryTask} numberOfLines={1}>{entry.TaskName || entry.Task?.Name || 'Task'}</Text>
                  <Text style={styles.entryProject} numberOfLines={1}>
                    {entry.CustomerName || ''}{entry.ProjectName ? ` · ${entry.ProjectName}` : ''}
                  </Text>
                  {entry.Comment ? <Text style={styles.entryComment} numberOfLines={1}>{entry.Comment}</Text> : null}
                </View>
              </View>
              {entry.Billable && <View style={styles.billableDot} />}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 0,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb', marginRight: 6 },
  logoText: { fontSize: 18, fontWeight: '700', color: '#2563eb' },
  disconnectBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: '#d1d5db' },
  disconnectText: { fontSize: 13, color: '#6b7280' },

  modeRow: { flexDirection: 'row', marginBottom: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' },
  modeTab: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  modeTabActive: { backgroundColor: '#2563eb' },
  modeTabText: { fontWeight: '600', color: '#6b7280', fontSize: 14 },
  modeTabTextActive: { color: '#fff' },

  // Step indicator
  stepRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#2563eb' },
  stepDotDone: { backgroundColor: '#10b981' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  stepNumActive: { color: '#fff' },
  stepDoneIcon: { fontSize: 13, color: '#fff', fontWeight: '700' },
  stepLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '500' },
  stepLabelActive: { color: '#2563eb' },
  stepConnector: { flex: 1, height: 2, backgroundColor: '#e5e7eb', marginBottom: 14 },
  stepConnectorActive: { backgroundColor: '#10b981' },

  // Breadcrumb
  breadcrumb: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10, gap: 4 },
  crumb: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  crumbText: { fontSize: 12, fontWeight: '600', color: '#2563eb', maxWidth: 120 },
  crumbEdit: { fontSize: 12, color: '#2563eb' },
  crumbSep: { fontSize: 14, color: '#9ca3af' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
    minHeight: 48,
    justifyContent: 'center',
  },
  picker: { height: 48 },
  disabled: { opacity: 0.5 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, marginBottom: 12 },
  loadingText: { fontSize: 13, color: '#6b7280' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dateButton: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, marginBottom: 12, backgroundColor: '#fafafa',
  },
  dateText: { fontSize: 14, color: '#111827' },
  input: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 14, color: '#111827',
    marginBottom: 12, backgroundColor: '#fafafa',
  },
  commentInput: { minHeight: 72, textAlignVertical: 'top' },

  // Button row (Back + Next/Submit side by side)
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  backButton: {
    paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center',
  },
  backButtonText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  nextButton: {
    backgroundColor: '#2563eb', borderRadius: 8,
    padding: 14, alignItems: 'center',
  },
  nextButtonFlex: { flex: 1 },
  nextButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  submitButton: {
    backgroundColor: '#2563eb', borderRadius: 8,
    padding: 14, alignItems: 'center', marginTop: 4,
  },
  submitButtonFlex: { flex: 1, marginTop: 0 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  buttonDisabled: { opacity: 0.6 },

  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  sheetHours: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  sheetButton: {
    borderWidth: 1.5, borderColor: '#2563eb', borderRadius: 8,
    padding: 12, alignItems: 'center',
  },
  sheetButtonText: { color: '#2563eb', fontWeight: '600', fontSize: 14 },

  emptyText: { fontSize: 14, color: '#9ca3af', fontStyle: 'italic' },
  entryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  entryLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  entryHours: { fontSize: 16, fontWeight: '700', color: '#2563eb', minWidth: 40 },
  entryTask: { fontSize: 14, fontWeight: '600', color: '#111827', flex: 1 },
  entryProject: { fontSize: 12, color: '#6b7280', flex: 1 },
  entryComment: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic', flex: 1 },
  billableDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', marginLeft: 8 },
});
