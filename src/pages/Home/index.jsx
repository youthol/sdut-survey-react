import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { Toast } from 'antd-mobile';
import moment from 'moment';
import axios from 'axios';
import qs from 'qs';
import BasicLayout from '@/layouts/BasicLayout';
import PageDesc from '@/components/PageDesc';
import SurveyForm from '@/components/SurveyForm';
import SubmitBtn from '@/components/SubmitBtn';
import Loading from '@/components/Loading';
import { updateCatid, updatePrefs, updateSurfs, updateRawData } from '@/actions/surveyData';
import { updateSurveyAnswers, clearAllAnswers } from '@/actions/surveyAnsws';

class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: true
    };
  }
  componentDidMount() {
    const { id } = this.props.match.params;
    if (!id) return;
    const { catid } = this.props.surveyData;

    if (catid !== Number(id)) {
      this.getSurveyData(Number(id));
    } else {
      this.setState({ loading: false });
    }
  }

  /**
   * @description 判断是否选择
   * @param {*} type 题型
   * @param {*} num 题号
   * @param {*} val
   * @returns
   */
  isChecked = (type, num, val) => {
    let { surveyAnswers } = this.props.surveyAnsws;
    // 1单选 2复选
    if (type === 1) {
      return surveyAnswers[num] === val;
    } else if (type === 2) {
      return !surveyAnswers[num] ? false : surveyAnswers[num].indexOf(val) > -1;
    }
  };

  /**
   * @description 处理单选多选改变事件
   * @param {*} type 题型：1单选2多选
   * @param {*} num 题号
   * @param {*} val
   */
  handleChange = (type, num, val) => {
    let { surveyAnswers } = this.props.surveyAnsws;

    switch (type) {
      case 1:
        surveyAnswers[num] = val;
        break;
      case 2:
        if (!surveyAnswers[num]) {
          surveyAnswers[num] = [];
          surveyAnswers[num].push(val);
        } else if (surveyAnswers[num].indexOf(val) === -1) {
          surveyAnswers[num].push(val);
        } else if (surveyAnswers[num].indexOf(val) >= 0) {
          surveyAnswers[num].splice(surveyAnswers[num].indexOf(val), 1);
        }
        if (surveyAnswers[num].length > 3) {
          surveyAnswers[num].shift();
        }
        break;
      case 3:
        surveyAnswers[num] = val;
        break;
      default:
        surveyAnswers[num] = val;
    }
    this.props.updateSurveyAnswers(surveyAnswers);
  };

  /**
   * @description 提交表单，验证问卷必选项和用户必填项
   * @param {*} e
   * @returns
   */
  handleSubmit = e => {
    e.preventDefault();
    const { catid, preFields, surveyFields, rawData } = this.props.surveyData;
    const { surveyAnswers, prefsAnswers } = this.props.surveyAnsws;
    const { user_required } = rawData;

    // 判断是否完成必选题
    const hasSurveyEmpty = surveyFields.filter(item => {
      if (item.input_type === 3) {
        return false; // 非必填项
      } else if (item.input_type === 2) {
        return !surveyAnswers[item.input_num] || !surveyAnswers[item.input_num].length;
      } else {
        return !!!surveyAnswers[item.input_num];
      }
    });

    if (hasSurveyEmpty.length) {
      Toast.info(`请先完成第${hasSurveyEmpty[0].input_num}题再提交`);
      return;
    }
    if (user_required) {
      for (let i in prefsAnswers) {
        if (prefsAnswers[i] instanceof Array) {
          prefsAnswers[i] = prefsAnswers[i].join();
        }
      }

      const hasPrefsEmpty = preFields.every(item => !prefsAnswers[item.input_num]);

      if (hasPrefsEmpty) {
        Toast.info('请完成用户必填信息', 1);
        this.props.history.push(`/prefs/${catid}`);
        return;
      }
    }
    const formData = {
      userinfo: prefsAnswers,
      answers: surveyAnswers
    };
    this.postSurveyAnswers(formData);
  };

  /**
   * @description 根据 id 获取问卷内容
   * @memberof Home
   */
  getSurveyData = id => {
    if (!id) return;
    const { baseUrl } = this.props;

    axios
      .get(`${baseUrl}/ques/${id}`)
      .then(res => {
        if (res.status >= 200 && res.status <= 300) {
          const { id, start_at, end_at } = res.data.data;
          if (moment().isBefore(start_at) || moment().isAfter(end_at)) {
            this.props.history.push({ pathname: `/result/${id}`, query: { key: 2 } });
            return;
          }
          const { login_questions, invest_questions, user_required } = res.data.data;
          const { updateCatid, updatePrefs, updateSurfs, updateRawData } = this.props;
          // TODO: 判断开放关闭时间段
          updateCatid(id);
          updatePrefs(login_questions);
          updateSurfs(invest_questions);
          updateRawData(res.data.data);
          this.setState({ loading: false });
          if (user_required) {
            this.props.history.push(`/prefs/${id}`);
          }
        }
      })
      .catch(err => {
        const { status_code, message } = err.response.data;
        switch (status_code) {
          case 404:
            Toast.info(message);
            this.props.history.push({ pathname: `/result/${id}`, query: { key: 3 } });
            break;
          default:
            Toast.info('未知错误');
        }
      });
  };

  /**
   * @description 向服务器发送请求，成功后跳转
   * @param {*} data
   * @returns
   */
  postSurveyAnswers = data => {
    if (!data) return;
    const { baseUrl } = this.props;
    const { catid } = this.props.surveyData;
    const params = qs.stringify(data);

    axios
      .post(`${baseUrl}/ques/${catid}`, params)
      .then(res => {
        if (res.status >= 200 && res.status <= 300) {
          // TODO: 判断返回
          console.log(res);
          Toast.success('提交成功');
          this.props.clearAllAnswers();
          this.props.history.push({ pathname: `/result/${catid}`, query: { key: 1 } });
        }
      })
      .catch(err => {
        console.error(err);
      });
  };

  render() {
    const { description } = this.props.surveyData.rawData;
    const { surveyFields } = this.props.surveyData;
    const { surveyAnswers } = this.props.surveyAnsws;
    return (
      <BasicLayout history={this.props.history}>
        {this.state.loading ? (
          <Loading />
        ) : (
          <div>
            <PageDesc description={description} />
            <SurveyForm
              surveyList={surveyFields}
              surveyAnswers={surveyAnswers}
              isChecked={this.isChecked}
              handleChange={this.handleChange}
            />
            <SubmitBtn handleSubmit={this.handleSubmit} />
          </div>
        )}
      </BasicLayout>
    );
  }
}

const mapStateToProps = state => ({
  baseUrl: state.baseUrl,
  surveyData: state.surveyData,
  surveyAnsws: state.surveyAnsws
});

const mapDispatchToProps = dispatch => ({
  updateCatid: bindActionCreators(updateCatid, dispatch),
  updatePrefs: bindActionCreators(updatePrefs, dispatch),
  updateSurfs: bindActionCreators(updateSurfs, dispatch),
  updateRawData: bindActionCreators(updateRawData, dispatch),
  clearAllAnswers: bindActionCreators(clearAllAnswers, dispatch),
  updateSurveyAnswers: bindActionCreators(updateSurveyAnswers, dispatch)
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Home);
