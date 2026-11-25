require "json"
require "minitest/autorun"
require "open3"
require "tmpdir"
require "yaml"

class ReleaseWorkflowTest < Minitest::Test
  WORKFLOW = YAML.load_file(File.expand_path("../.github/workflows/release.yml", __dir__))
  JOB = WORKFLOW.fetch("jobs").fetch("release")
  STEPS = JOB.fetch("steps")
  GUARD = STEPS.find { |step| step["name"] == "Check release tag against package version" }

  def test_manual_checkout_uses_the_tag_namespace_and_push_uses_the_event_revision
    checkout = STEPS.first
    assert_match %r{\Aactions/checkout@}, checkout.fetch("uses")
    assert_equal "${{ github.event_name == 'workflow_dispatch' && format('refs/tags/{0}', inputs.tag) || '' }}",
                 checkout.fetch("with").fetch("ref")
    assert_equal "${{ inputs.tag || github.ref_name }}", JOB.fetch("env").fetch("TAG_NAME")
    assert_equal GUARD, STEPS.fetch(1)
  end

  def check_tag(tag, version)
    Dir.mktmpdir do |dir|
      File.write(File.join(dir, "package.json"), JSON.generate(version: version))
      Open3.capture2e({ "TAG_NAME" => tag }, "bash", "-e", "-c", GUARD.fetch("run"), chdir: dir)
    end
  end

  def test_tag_matches_the_complete_package_version
    output, status = check_tag("v1.2.3-rc.1", "1.2.3-rc.1")
    assert status.success?, output
  end

  def test_tag_must_match_exactly
    ["v1.2.4", "1.2.3", "v1.2.*"].each do |tag|
      output, status = check_tag(tag, "1.2.3")
      refute status.success?, output
      assert_includes output, "does not match"
    end
  end

  def test_missing_version_fails
    _, status = check_tag("v", nil)
    refute status.success?
  end
end
