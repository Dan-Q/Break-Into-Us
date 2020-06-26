#!/usr/bin/env ruby
require 'json'

PUZZLES_FILE = 'public/puzzles.json'
JSON_PRETTY_PRINT = true

class Alphabet
  def initialize(characters)
    @characters = characters.to_a
  end

  def combos(length)
    @characters.product(*(length - 1).times.map{@characters}).map do |c|
      Combo.new(c.join)
    end
  end

  def to_a
    @characters
  end

  def length
    @characters.length
  end
end

class Combo < String
  def digits
    @digits ||= self.chars
  end

  def frequencies
    return @frequencies if @frequencies
    @frequencies = {}
    10.times do |i|
      @frequencies[i.to_s] = digits.count{ |j| j == i.to_s }
    end
  end
end

class ComboSet
  def initialize(alphabet: (0..9), length: 3)
    @alphabet = Alphabet.new(alphabet)
    @combos = @alphabet.combos(length)
  end

  def length
    @combos.length
  end

  def random
    @combos[(rand * @combos.length).floor]
  end

  def shuffled_set
    @combos.shuffle
  end

  def filter_by(rules)
    @combos.select do |combo|
      [*rules].all?{|rule| rule.matches?(combo)}
    end
  end

  def filter_by!(rules)
    [*rules].each do |rule|
      @combos = @combos.select do |combo|
        rule.matches?(combo)
      end
    end
    self
  end

  def to_s
    "#{@combos.length} combinations:\n#{@combos.join("\n")}"
  end
end

class RuleException < Exception
end

# Raised when you should have used a Rule subclass
class UndefinedRuleException < RuleException
end

class InvalidRuleException < RuleException
end

class Rule
  NUMBERS = %w{no one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty}

  attr_accessor :pattern

  def initialize(pattern)
    @pattern = pattern
  end

  def difficulty
    1.0
  end

  def show_pattern
    true
  end

  def number(num)
    return 'all' if(num == @pattern.length)
    NUMBERS[num]
  end

  def digits
    @digits ||= @pattern.chars
  end

  def matches?(combo)
    raise UndefinedRuleException
  end

  def description
    raise UndefinedRuleException    
  end

  def to_s
    sprintf(' "%s" %-30s %s', (show_pattern ? @pattern : ''), self.class.name, description)
  end

  def data
    hash = {
      description: description,
      class: self.class.name,
    }
    hash[:pattern] = pattern if show_pattern
    hash
  end

  def valid?
    # by default, a rule isn't valid if it duplicates digits, as this can lead to ambiguous wording in many (e.g. cow) rule types
    digits.uniq.length == digits.length
  end
end

class BullsCowsRule < Rule
  def initialize(pattern, target_number, target_gender)
    super(pattern)
    target_gender = target_gender.to_s
    raise InvalidRuleException if (target_number = target_number.to_i) < 0
    if (target_gender == 'cows') || (target_gender == 'cow')
      @target_bulls, @target_cows = 0, target_number
    elsif (target_gender == 'bulls') || (target_gender == 'bull')
      @target_bulls, @target_cows = target_number, 0
    else
      raise InvalidRuleException
    end
  end

  def matches?(combo)
    (@target_cows == cows(combo)) && (@target_bulls == bulls(combo))
  end

  # Bulls = correct numbers in correct place
  def bulls(combo)
    count = 0
    digits.each_index do |i|
      count += 1 if digits[i] == combo.digits[i]
    end
    count
  end

  # Cows = correct numbers in wrong place
  def cows(combo)
    digits.uniq.select{|d| combo.digits.include?(d)}.length - bulls(combo)
  end

  def description
    if (@target_bulls > 0) && (@target_cows == 0)
      "#{number(@target_bulls)} #{@target_bulls == 1 ? 'digit is' : 'digits are'} right and in the right place"
    elsif (@target_cows > 0) && (@target_bulls == 0)
      "#{number(@target_cows)} #{@target_cows == 1 ? 'digit is' : 'digits are'} right but in the wrong place"
    else
      # fallback description
      "#{number(@target_bulls)} #{@target_bulls == 1 ? 'bull' : 'bulls'}, #{number(@target_cows)} #{@target_cows == 1 ? 'cow' : 'cows'}  [ICK!]"
    end
  end

  def valid?
    # bulls/cows rules with a nonzero number of bulls or cows shouldn't have duplicate digits in their pattern 'cos it CAN lead to ambiguity
    return false if ((@target_bulls + @target_cows) > 0) && (digits.uniq.length < digits.length)
    # bulls-only rules are always valid
    return true if (@target_bulls > 0) && (@target_cows == 0)
    super
  end
end

class NoBullsCowsRule < BullsCowsRule
  def initialize(pattern)
    super(pattern, 0, 'cows')
  end

  def description
    "all digits are wrong (none of these digits are in the combination)"
  end

  def valid?
    true
  end
end

class SumOfDigitsRule < Rule
  def difficulty
    1.0 * (sum_of_digits / 2)
  end

  def show_pattern
    false
  end

  def sum_of_digits
    @sum_of_digits ||= digits.map(&:to_i).sum
  end

  def matches?(combo)
    sum_of_digits == combo.digits.map(&:to_i).sum
  end

  def description
    "the digits of the combination add up to exactly #{sum_of_digits}"
  end

  def valid?
    true
  end
end

class ParityCountComparisonRule < Rule
  def difficulty
    10.0
  end

  def show_pattern
    false
  end

  def parity(combo = nil)
    combo ||= @pattern
    evens = combo.digits.map(&:to_i).select(&:even?).length
    odds = combo.length - evens
    evens > odds ? 'even' : (odds > evens ? 'odd' : 'balanced')
  end

  def antiparity(combo = nil)
    (parity(combo) == 'even') ? 'odd' : 'even'
  end

  def matches?(combo)
    parity(combo) == parity()
  end

  def description
    return 'there are an equal number of odd and even digits' if parity() == 'balanced'
    "the number of #{parity()} digits is greater than the number of #{antiparity()} digits"
  end

  def valid?
    true
  end
end

class DiffDigitsRule < Rule
  def difficulty
    8.0
  end

  def show_pattern
    false
  end

  def diff_digits(combo = nil)
    (combo || @pattern).chars.uniq.length
  end

  def matches?(combo)
    diff_digits(combo) == diff_digits()
  end

  def description
    "#{diff_digits()} different digits are used in the combination"
  end

  def valid?
    true
  end
end

class StaircaseRule < Rule
  def difficulty
    10.0
  end

  def show_pattern
    false
  end

  def ascending?(combo = nil)
    combo ||= @pattern
    combo[0].ord.odd?
  end

  def matches?(combo)
    digits = combo.chars.sort.join
    digits.reverse! unless ascending?
    digits == combo
  end

  def description
    "the digits of the combination are in #{ascending?() ? 'ascending' : 'descending'} order (i.e. later digits are never #{ascending? ? 'lower' : 'higher'} than earlier ones)"
  end

  def valid?
    true
  end
end

class Puzzle
  attr_accessor :answer, :combos, :alphabet, :length, :rules

  DEFAULT_OPTIONS = {
    target_reduction_threshold: 0.9,     # what's the max proportion of combos that may remain after a rule
    target_reduction_threshold_above: 10 # how few combos left before the max-proportion rule stops applying
  }

  def difficulty
    score = ([1, @length - 1].max + (@alphabet.length.to_f / 2)) * @rules.map{|rule| rule.difficulty}.sum
    [(score / 5).round(1), 1].max
  end

  def default_rule_templates
    rule_templates = [
      { rule: BullsCowsRule.new(:template, 1, 'cows'), weighting: 12 },
      { rule: NoBullsCowsRule.new(:template), limit: (@length > 4 ? 2 : @length - 2), weighting: 4 },
      { rule: DiffDigitsRule.new(:template), limit: 1, weighting: 2 + @length }
    ]
    if @alphabet.to_a.all?{|digit| digit.to_s =~ /^[0-9]$/}
      rule_templates.push({ rule: SumOfDigitsRule.new(:template), limit: 1 })
      rule_templates.push({ rule: ParityCountComparisonRule.new(:template), limit: 1 })
      rule_templates.push({ rule: StaircaseRule.new(:template), limit: 1 })
    end
    if @length > 2
      (@length - 2).times do |i|
        rule_templates.push({ rule: BullsCowsRule.new(:template, i + 1, 'bulls'), limit: (@length == 3 ? 2 : 1), weighting: 4 })
        rule_templates.push({ rule: BullsCowsRule.new(:template, i + 1, 'cows'), limit: (@length == 3 ? 2 : 1), weighting: 8 })
      end
    end
    (@length - 1).times do |i|
      rule_templates.push({ rule: BullsCowsRule.new(:template, i + 1, 'cows'), limit: 1, weighting: 4 })
    end
    rule_templates
  end

  def valid_rule_templates
    # Filter rule templates down to those which are not overused
    suggested_rule_templates = @rule_templates.reject do |rule_template|
      rule_template[:limit] && rule_template[:num] && ( rule_template[:num] >= rule_template[:limit] )
    end
    # Weight them so some rules are more-likely to be picked than others
    suggested_rule_templates.flat_map do |rule_template|
      [rule_template] * (rule_template[:weighting] || 1)
    end
  end

  def valid_candidate_rule
    pre_matches = @combos.filter_by(@rules).length
    patterns = @combos.shuffled_set
    patterns.each do |candidate_pattern|
      valid_rule_templates.shuffle.each do |candidate_rule_template|
        candidate_new_rule = candidate_rule_template[:rule].dup
        candidate_new_rule.pattern = candidate_pattern
        next unless candidate_new_rule.valid?
        post_matches = @combos.filter_by(@rules + [candidate_new_rule]).length
        reduction_threshold = (post_matches.to_f / pre_matches)
        next unless post_matches > 0
        next unless post_matches < pre_matches
        next unless (post_matches < @options[:target_reduction_threshold_above]) || (reduction_threshold <= @options[:target_reduction_threshold])

        candidate_rule_template[:num] ||= 0
        candidate_rule_template[:num] += 1
        return candidate_new_rule
      end
    end
    raise ["No possible rule found!", @combos.length, @rules].inspect
  end

  def initialize(alphabet: (0..9), length: 3, rule_templates: nil, seed: nil, options: {})
    puts "Seed: #{seed ||= (rand * (10**64)).to_i}"
    srand seed
    @alphabet, @length = Alphabet.new(alphabet), length
    @combos = ComboSet.new(alphabet: @alphabet, length: @length)
    @options = DEFAULT_OPTIONS.merge(options)
    @rule_templates = rule_templates || default_rule_templates
    @rules = []
    puts "Starting combos: #{@combos.length}"
    loop do
      @rules.push self.valid_candidate_rule
      printf " (%6d)   %s\n", @combos.filter_by(@rules).length, @rules.last.to_s
      break if @combos.filter_by(@rules).length == 1
    end
    @answer = @combos.filter_by(@rules)
    puts "Answer: #{@answer} | Difficulty: #{difficulty} | Digits Used: #{@answer[0].chars.uniq.length}"
  end

  def data
    {
      answer: @answer,
      alphabet: @alphabet.to_a.map(&:to_s),
      length: @length,
      rules: @rules.shuffle.map(&:data),
      difficulty: difficulty,
    }
  end
end

###############################################################################

# * alphabet size
print 'Alphabet (0-9, 1-5)? '
a = if ARGV[0]
  puts ARGV[0].strip
  ARGV[0].strip
else
  STDIN.gets.strip
end
alphabet = if a == ''
  (0..9)
elsif a =~ /^(\d)-(\d)$/
  ($1.to_i..$2.to_i)
else
  a.upcase.chars
end
# * length
print 'Length? '
l =if ARGV[1]
  puts ARGV[1].strip
  ARGV[1].strip
else
  STDIN.gets.strip
end
length = l == '' ? 3 : l.to_i

puzzle = Puzzle.new(
  # seed: 5478082426927421143456472927435492873712636496827853755134246912,
  alphabet: alphabet,
  length: length,
  # options: { target_reduction_threshold: 0.7 },
)
print 'Keep? (^C = no, enter = yes; optionally type a title) '
title = STDIN.gets.strip
puzzle_data = puzzle.data
puzzle_data[:title] = title if title != ''
puzzles = File.exists?(PUZZLES_FILE) ? JSON.parse(File.read(PUZZLES_FILE)) : []
puzzles << puzzle_data
File.open(PUZZLES_FILE, 'w'){|f| f.puts (JSON_PRETTY_PRINT ? JSON.pretty_generate(puzzles) : puzzles.to_json)}

###############################################################################

# combos = ComboSet.new
# puts combos.filter_by! [
#   BullsCowsRule.new('682', 1, 'bull'),
#   BullsCowsRule.new('614', 1, 'cow'),
#   BullsCowsRule.new('206', 2, 'cows'),
#   NoBullsCowsRule.new('738'),
#   BullsCowsRule.new('380', 1, 'cow'),
# ]

